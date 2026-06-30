---
title: "Forge 开发笔记 05：Agent 跑到一半断了怎么办"
date: '2026-06-30'
categories:
    - AI
---

短任务可以靠一次运行完成，长任务不能。

只要你认真用过 Coding Agent，就会遇到这种情况：任务跑到一半，模型 API 超时；本地进程断掉；电脑睡眠；网络抖动；上下文已经走了好几轮，文件也改了一半。这时候如果系统没有保存状态，用户只能重新开始，然后希望 Agent 能“猜”出前面发生了什么。

Forge 的 v0.4 加入 Checkpoint 和 Resume，就是为了把这种脆弱性补上。

# Agent 任务是过程，不只是结果

普通函数调用失败后可以重试，因为输入通常还在，副作用也比较明确。但 Agent 不一样。

一个 Coding Agent 的运行状态至少包括：

- 原始任务
- 当前迭代轮次
- system prompt
- message history
- tool calls 和 tool results
- verifier 配置
- trace steps
- workspace 中已经发生的文件修改

如果这些状态没有保存，所谓“恢复”就只能靠重新描述任务。可重新描述任务并不能还原过程。模型不知道前面读过什么、改过什么、失败过什么，也不知道哪些路径已经被排除。

所以 v0.4 的核心思路很直接：每轮迭代后保存 checkpoint，把 Agent 的对话状态和 trace 序列化到磁盘。

# Checkpoint 保存什么

Forge 的 checkpoint 不是只保存一个“进度条”，而是保存足够恢复 agent loop 的运行材料。

它包括当前任务、当前 iteration、system prompt、messages、test command，以及已经记录的 trace steps。Resume 时，runner 会读取 checkpoint，恢复 message history 和 trace，然后从下一轮继续跑。

这让中断后的 Agent 不必重新理解世界。它可以接着之前的上下文继续行动。

`examples/demo_checkpoint.py` 里故意模拟了一次 API 断连：Agent 已经列文件、读文件、打了补丁，下一轮模型调用时抛出异常。第一次运行保存了 checkpoint；第二次启动时从 checkpoint 恢复，继续运行测试并完成任务。

这个 demo 展示的不是“异常处理写得好”，而是一个更重要的事实：Agent 的状态必须被当作一等公民。

# Trace 和 Checkpoint 是一对

Checkpoint 解决恢复问题，Trace 解决观察问题。两者看起来用途不同，但在 Agent 系统里经常绑在一起。

如果只有 checkpoint，没有 trace，你可以继续运行，但很难知道之前发生了什么。如果只有 trace，没有 checkpoint，你可以复盘失败，但不能从失败点继续。

Forge 在 v0.4 里给 `StepTrace` 增加了反序列化能力，让历史 trace steps 也能被恢复。这意味着一次被中断的任务，在恢复后仍然保留完整故事：中断前做了什么，中断后又怎么继续。

对教学应用来说，这一点很有价值。因为真实 Agent 的学习材料不只来自成功完成的任务，也来自“中途坏掉又恢复”的任务。恢复过程本身，就是理解 Agent 状态管理的最好案例。

# 长任务需要工程耐心

很多 Agent 系统一开始都会低估长任务。

短任务里，状态存在内存里就够了；长任务里，内存状态随时可能消失。短任务里，用户可以忍受失败重来；长任务里，失败重来会让人完全失去信任。短任务里，模型输出看起来像重点；长任务里，调度、保存、恢复、验证这些基础设施才决定系统是否可用。

Checkpoint 的加入，让 Forge 从一个演示型 agent loop 向真实工作流靠近了一步。

它也传达了一个朴素但重要的教学点：Agent 是连续过程。只要是连续过程，就要考虑中断；只要考虑中断，就要设计状态。

# Resume 改变用户心智

当系统支持 resume，用户和 Agent 的关系也会变化。

用户不再需要把每次运行都当成一次孤注一掷的尝试。任务可以被暂停，可以失败，可以恢复，可以继续验证。这种心智更接近真实软件开发：我们不会因为一次测试失败就把项目删掉，而是保留上下文，修正问题，继续前进。

Forge 想教的不是“Agent 永远不断”，而是“Agent 断了以后也能知道自己在哪里”。

这才是长任务协作的基础。
