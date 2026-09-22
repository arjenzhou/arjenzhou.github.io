---
title: 当副作用遇上事务传播：一个时序问题的两次误判
date: '2026-09-22'
categories:
    - 后端
---

在基于 Spring 事务管理的系统中，业务副作用（如消息发送）与事务提交之间的时序一致性是一个容易被忽视的问题。当业务逻辑涉及嵌套方法调用，且内外层方法共享同一事务上下文时，"业务逻辑完成"与"事务提交"之间存在语义上的不等价性。

本文通过两次生产故障的分析，揭示事务传播语义和事务同步回调生命周期中两个易被误判的时序节点。两次故障的共同特征是：出问题的代码本身逻辑正确，但被放入了预期之外的事务上下文。

> 注：本文中的代码均为伪代码，用于说明问题结构，不代表实际生产代码。

# 问题背景

系统中存在一个通用的状态机处理组件，负责状态流转并在流转完成后发送消息通知下游。该组件独立运行时工作正常——方法自身声明了 `@Transactional`，状态变更提交后再发消息，时序无误。

问题出现在该组件被其他业务代码调用时：外层调用方也持有事务，导致状态机组件不再是事务的发起者，其对提交时机的假设随之失效。

# 第一次故障：外层事务改变了提交边界

## 现象

状态机组件在状态流转完成后直接发送消息，消费者反查数据库，发现数据不存在。

状态机组件的代码：

```java
@Transactional
public void transition(Long orderId, State targetState) {
    stateMachineRepository.updateState(orderId, targetState);
    messageSender.send(orderId);  // ← 状态流转完成，发送消息
}
```

该组件被某个业务方法调用，而该业务方法自身也声明了事务：

```java
@Transactional
public void createOrder(OrderRequest request) {
    orderRepository.save(new Order(request));
    stateMachineService.transition(request.getOrderId(), State.CREATED);
    // 后续逻辑...
}
```

调用链如下：

```
createOrder()                                    ← 事务发起者（非状态机组件）
  └─ orderRepository.save()
  └─ transition()                                ← REQUIRED, 加入外层事务
       └─ stateMachineRepository.updateState()   ← 写入状态变更
       └─ messageSender.send()                   ← 消息发出，但事务尚未提交
  └─ 后续逻辑...
事务提交 → Connection.commit()                    ← 真正的提交在这里
```

## 分析

`transition()` 声明了 `@Transactional`，传播行为为默认的 `REQUIRED`。当 `transition()` 独立调用时，它自身即为事务发起者，方法返回时触发提交，消息发送时序正确。但当 `createOrder()` 在外层开启了事务时，`transition()` 加入的是外层事务，两者映射到同一个物理事务，内层方法不具备独立的提交点。

`transition()` 返回时，执行的是逻辑上的方法返回，而非事务的提交。`messageSender.send()` 执行时，状态变更数据尚处于未提交状态，对其他事务不可见。

## 根因

状态机组件假设自身为事务发起者，方法返回即提交。当外层代码引入了新的事务边界时，该假设不再成立。组件的正确性依赖于一个未被显式声明的前提条件：调用方不持有事务。

# 第二次故障：afterCommit 回调中的上下文残留

## 现象

第一次故障修复后，状态机组件的消息发送改为注册 `afterCommit` 回调。问题在原有调用路径上不再复现。但在另一个调用点——一条与 `createOrder()` 无关的独立业务路径中——消息再次丢失，且无异常抛出。

由于故障发生在不同的调用点，且该调用点的代码同样不在状态机组件的控制范围内，排查时未能第一时间关联到同一类问题。

## 调用链

该路径的结构如下：外层事务方法调用了另一个业务方法，该方法在 `afterCommit` 回调中触发了状态机组件。状态机组件内部同样尝试注册 `afterCommit` 回调来发送消息。

外层业务方法的代码：

```java
@Transactional
public void outerTransactionalMethod() {
    // 业务逻辑...
    TransactionSynchronizationManager.registerSynchronization(
        new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                stateMachineService.transition(orderId, State.COMPLETED);  // ← 回调 A
            }
        }
    );
}
```

第一次故障修复后的状态机组件：

```java
@Transactional
public void transition(Long orderId, State targetState) {
    stateMachineRepository.updateState(orderId, targetState);
    TransactionSynchronizationManager.registerSynchronization(
        new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                messageSender.send(orderId);  // ← 回调 B（无效）
            }
        }
    );
}
```

调用链如下：

```
outerTransactionalMethod()                              ← 事务发起者
  └─ 业务逻辑...
  └─ registerSynchronization(afterCommit {              ← 注册回调 A
         stateMachineService.transition()
     })
外层事务提交 → Connection.commit()
  └─ triggerAfterCommit()                               ← 触发回调 A
       └─ transition()
            └─ registerSynchronization(afterCommit {    ← 注册回调 B（无效）
                   messageSender.send()
               })
```

问题的关键在于 `AbstractPlatformTransactionManager` 中事务完成阶段的执行顺序。查看 Spring 源码中 `processCommit()` 的实现，事务提交后的处理流程如下：

```
1. Connection.commit()

2. triggerAfterCommit()
   2.1 synchronizations = [回调 A]                          ← 获取已注册列表，回调 B 尚不存在
   2.2 for sync in synchronizations:
       └─ sync.afterCommit()                                ← 执行回调 A
            └─ stateMachineService.transition()
                 └─ registerSynchronization(回调 B)          ← 注册成功，但不在 2.1 的列表中
   2.3 // 遍历结束                                           ← 回调 B 未被执行

3. triggerAfterCompletion(STATUS_COMMITTED)                  ← 触发 afterCompletion，非 afterCommit

4. cleanupAfterCompletion()
   └─ TransactionSynchronizationManager.clear()              ← 此时才清理上下文，回调 B 被丢弃
```

回调 B 注册时，步骤 4 的 `clear()` 尚未执行，`isSynchronizationActive()` 返回 `true`，`registerSynchronization()` 不抛异常。从 API 层面看一切正常，但回调 B 永远不会被触发。

事实上，Spring 在 [`TransactionSynchronization.afterCommit()`](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/TransactionSynchronization.html#afterCommit()) 的 Javadoc 中已经对此做出了警告：

> **NOTE:** The transaction will have been committed already, but the transactional resources might still be active and accessible. As a consequence, any data access code triggered at this point will still "participate" in the original transaction, allowing to perform some cleanup (with no commit following anymore!), unless it explicitly declares that it needs to run in a separate transaction. Hence: **Use `PROPAGATION_REQUIRES_NEW` for any transactional operation that is called from here.**

文档明确指出：`afterCommit` 执行时事务资源仍然活跃且可访问，但不会再有后续的提交（"no commit following anymore"）。这正是第二次故障的根源——新注册的 `afterCommit` 回调进入了一个已经完成遍历的列表，等待一个不会再来的提交事件。

## 根因

状态机组件在修复第一次故障后，假设"存在事务同步上下文即可安全注册 `afterCommit` 回调"。但在该调用路径中，组件运行在一个已触发过提交事件的上下文中。上下文的存活性不等于提交事件的可达性。

# 结论

两次故障的根因可以归结为一个共性问题：**通用组件对自身所处事务上下文的假设，在被不同调用方集成时被打破。**

第一次，外层调用方引入的事务改变了提交边界，组件不再是事务发起者；第二次，外层调用方在 `afterCommit` 回调链中调用组件，上下文残留制造了一个可注册但不可触发的窗口。

这揭示了一个更一般性的问题：在 Spring 声明式事务管理下，`@Transactional` 方法的事务行为不仅取决于自身的声明，还取决于调用方的事务上下文。当一个组件无法控制自身的调用环境时，对事务生命周期的任何隐式假设都可能成为故障点。

Spring 框架本身提供了针对这类问题的机制。文档 [Transaction-bound Events](https://docs.spring.io/spring-framework/reference/data-access/transaction/event.html) 中指出：

> If you need to bind it to the transaction, use `@TransactionalEventListener`. When you do so, the listener is bound to the commit phase of the transaction by default.

`@TransactionalEventListener` 将副作用的触发时机从手动注册回调转为声明式的事务阶段绑定，由框架统一管理注册和触发的生命周期，从根本上避免了手动管理回调时序所带来的两类问题。

