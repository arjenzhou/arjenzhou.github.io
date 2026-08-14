---
title: "Harness 再理解：让 Agent 可持续、可验证、可恢复地运行"
date: '2026-08-14'
categories:
    - AI
---

在上一篇文章[《Harness：LLM 之外的 Agent 工程》](../../07/what-is-agent-harness/)里，我把 Harness 定义为：

```text
Agent = LLM + Harness

Harness = LLM 之外、让模型能感知、行动、反馈、受约束的工程系统
```

这个定义现在看仍然成立。

它试图划出一条工程边界：LLM 负责理解、推理和决策，Harness 负责把模型接到真实环境里。它把世界整理成上下文，把模型的意图变成动作，再把动作结果变成反馈，同时管理权限、风险和完成条件。

但这个定义主要描述的是一次 Agent 循环的横截面。最近重新看了 [Anthropic 的长任务 Harness 实验](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)和 [OpenAI 的 Harness Engineering 实践](https://openai.com/index/harness-engineering/)后，我意识到它还缺少一个重要维度：**时间**。

一个真正进入生产环境的 Agent，不只要在当前这一轮里正确感知和行动，还要在几十甚至几百次连续决策中维持目标、保存状态、发现并纠正错误，并在上下文压缩、网络断开、进程重启之后继续工作。

所以，我现在更愿意这样描述 Harness：

```text
Harness 是 LLM 之外，把世界整理为上下文、把意图转化为动作、
把结果形成反馈，并使这套循环在明确边界内可持续、可验证、
可恢复运行的工程系统。
```

这不是推翻原来的定义，而是给它补上纵向的时间轴。

## 从“能行动”到“能长期可信地行动”

短任务很容易掩盖 Harness 的重要性。

读取一个文件、回答一个问题，可能只需要一到五次决策。即使上下文里有一些噪音，即使工具结果不够理想，模型也可能凭借自身能力把任务完成。

长任务不同。一次跨模块重构、深度调研或者复杂报告分析，可能包含几十次模型调用和上百次工具调用。随着任务变长，两个问题会从局部问题变成系统问题：

1. 完整轨迹不再适合持续保留在同一个上下文窗口里；
2. 前面一次未被发现的错误，会影响后面一连串判断。

这不是纯粹的理论推演。Anthropic 在长任务实验中观察到，即使 Harness 已经具备压缩能力，Agent 跨越多个上下文窗口时仍然容易失去连续进展；他们最终引入初始化 Agent、增量执行和结构化交接物，让后续会话能够接续前面的工作。

可以用一个高度简化的模型理解第二点。假设每一步相互独立，单步成功率为 $p$，连续执行 $n$ 步且每一步都成功的概率可写为：

```text
P(success) = p^n
```

当单步成功率是 95% 时，连续 100 步全部成功的概率只有约 0.6%；提高到 99%，整体成功率也只有约 37%。现实中的步骤并不独立，Agent 也可以纠错，但这个简化模型揭示了一个事实：**任务越长，系统越不能把希望寄托在“模型这次应该能做对”上。**

模型负责跨过能力门槛。跨过之后，任务能否稳定完成，越来越取决于验证、状态、恢复和上下文工程。

## Harness 还是一个时间系统

上一篇文章把 Harness 的作用归纳为三件事：

1. 把世界整理成模型可以理解的上下文；
2. 把模型的意图变成真实动作；
3. 把结果变成反馈，并定义行动边界。

对于长任务，现在可以再增加一件事：

> Harness 维护任务在时间上的连续性。

这里的连续性不只是“保存聊天记录”，而是保存一个任务继续运行所需要的事实：当前目标是什么，已经完成了哪些步骤，执行过哪些有副作用的动作，哪些工具调用尚未产生结果，工作区发生了什么变化，以及完成判断需要哪些证据。

于是，一次 Agent 执行不再只是一个循环：

```text
上下文 → 推理 → 动作 → 反馈 → 下一轮推理
```

而是一个可持久化、可恢复的循环：

```text
读取状态 → 组装上下文 → 推理 → 执行动作 → 保存结果
    ↑                                            ↓
    └──────── 压缩 / 挂起 / 中断 / 恢复 ────────┘
```

承载执行的 Worker 和沙箱可能被销毁，连接也可能中断，但任务状态不能跟着消失。进程内存只能是缓存，持久化的消息、工作区、检查点和工具结果才是恢复时的事实来源。

恢复也不能简单地“从上一轮重新执行”。对于创建文件、发送消息、提交工单这类有副作用的动作，重复执行可能比任务失败更糟。Harness 需要知道哪些 tool call 已经有对应结果，只补做尚未完成的部分，并尽可能为有副作用的动作提供幂等键。

从这个角度看，Session 不是聊天容器，而是一个可恢复任务的状态载体。

这类设计已经出现在生产系统和 Agent 框架中。[Codex App Server](https://openai.com/index/unlocking-the-codex-harness/) 会持久化 Thread 的事件历史，使客户端能够重新连接并恢复一致的时间线；[LangGraph 的持久化机制](https://docs.langchain.com/oss/python/langgraph/persistence)则以 Checkpoint 保存图状态，并保留已经完成节点的写入，恢复时不必重复执行成功步骤。

## Context 不是仓库，而是工作集

我之前把 Context 看作 Harness 对世界的选择、压缩和排序。这个理解没有错，但还可以更进一步：**Context 是模型完成当前决策所需的工作集，不是任务的永久存储。**

窗口“装得下”不等于模型“用得好”。随着上下文变长，过时状态、重复错误、无关工具输出和早期错误判断都会竞争注意力。无关信息不是中性的，错误信息也不只是占空间，它们可能直接改变模型的下一步决策。

因此，Context 管理不能只依靠达到阈值后的整体压缩。完整的信息生命周期至少包括四个部分：

```text
当前上下文：保证模型此刻能够正确行动
外部状态：保存任务中确定、可恢复的事实
压缩摘要：维持任务叙事和近期进展
事实召回：需要时找回未被摘要损失的原始细节
```

压缩解决的是“任务怎样继续”，检索解决的是“事实怎样保持准确”。如果只做压缩，不做状态外置和事实召回，每次摘要都会产生不可逆的信息损失，多次压缩之后尤其明显。

上下文治理还包括一些更细的工程问题：

- 重复的错误栈应该折叠，避免模型在同一条失败路径上持续重试；
- 相同工具和相同参数的重复调用需要被识别；
- 工具调用的入参也需要治理，写文件时携带的全文可能比工具结果更大；
- 目标、当前计划、关键的历史动作及其副作用，应在压缩或恢复后重新变得显著；
- 已发生的事件和当前状态快照需要区别处理：关键事件不能丢，状态只应保留最新版本。

这让我对 Context 有了一个新的判断：好的 Context Engineering 不是尽可能给模型更多信息，而是在每个决策点提供**足够且可信的最小工作集**。

[Anthropic 对 Context Engineering 的总结](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)也强调，长任务需要同时处理上下文污染和信息相关性问题，并把压缩、结构化笔记和多 Agent 架构列为延长任务时间跨度的主要手段。[OpenAI 对 Codex Agent Loop 的拆解](https://openai.com/index/unrolling-the-codex-agent-loop/)则展示了另一种具体实现：当上下文超过阈值时自动压缩会话，让 Agent 在释放窗口空间的同时继续任务。

## Feedback 必须升级为验证闭环

Harness 会把动作结果返回给模型，但“有反馈”并不等于“形成了可靠闭环”。

以修复代码为例，一个弱循环可能是：

```text
读取代码 → 修改文件 → 宣布完成
```

一个更可靠的循环则是：

```text
读取代码 → 修改文件 → 查看 diff → 运行相关测试
    ↑                                  ↓
    └──────── 解释失败并修正 ──────────┘
```

两者可以使用相同模型和相同工具，结果却可能明显不同。差异不在模型是否“知道应该测试”，而在 Harness 有没有把验证变成完成路径的一部分。

反馈可以分成三个层次：

1. **Observation**：发生了什么，例如退出码、测试结果和 diff；
2. **Interpretation**：结果意味着什么，例如失败来自当前改动还是环境；
3. **Verification**：证据是否足以证明任务已经完成。

这也是为什么 completion gate 很重要。模型生成“已经完成”只是一条候选判断，系统还需要检查改动形状、测试证据、任务约束和交付物是否满足要求。

完成不是一句自然语言，而是一个有证据的状态迁移。

这也对应了 [Anthropic 对 Agent Evals 的定义](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)：Transcript 记录 Agent 说了什么、调用了什么工具，Outcome 则描述环境最终变成了什么状态。Agent 声称“已经完成”属于前者，任务结果是否真实存在才属于后者。

## 工具失败不等于任务失败

长任务中，文件不存在、命令返回非零、参数不合法都是正常现象。它们通常意味着模型需要换一个参数或选择另一条路径，而不是整个任务必须终止。

因此，工具错误首先应该成为结构化 observation，进入下一轮推理。只有工具注册损坏、schema 无法构造或状态无法保持一致这类框架级错误，才应该直接终止任务。

另一方面，错误处理必须给出明确终态。失败、暂停、中断、等待用户和完成是不同状态。“卡住了但看起来仍在运行”通常比明确失败更危险，因为它既难以被发现，也难以重试，还会持续占用资源。

生产级 Harness 不只需要管理 happy path，还要明确任务如何结束、如何失败，以及失败后如何继续。

## 不存在普适最优的 Harness

上一篇文章里我写过：

```text
Agent 的通用性更多来自 LLM。
Agent 的领域性主要来自 Harness。
```

现在我认为这句话还可以说得更精确一些：

> Agent 的领域性，不只来自它接入了哪些数据和工具，更来自这个领域特有的任务结构、验证方式和失败恢复策略。

代码修复的核心循环是“修改—验证—修正”，报告分析的核心可能是“流程编排—数据汇总—结构化产出—交叉检查”。两者都需要文件、命令和检索工具，但并不需要同一种 Harness。

所以，设计 Harness 的起点不应该是复制一个公认强大的 Agent，而应该是分析目标任务：

- 它由哪些连续决策组成；
- 什么错误最容易被连锁放大；
- 哪些结果可以被确定性验证；
- 哪些动作有不可逆副作用；
- 哪些事实必须跨上下文和跨会话保存；
- 什么证据足以允许任务结束。

工具集合定义了 Agent 能做什么，控制循环决定了它能否可靠地完成这类任务。

## Harness Engineering 是一个反馈循环

如果 Harness 决定了 Agent 如何行动，那么 Harness 本身也需要持续学习。

这里的“学习”不一定意味着训练模型。更多时候，它意味着把一次失败转化成确定性的工程改进：增加验证、调整工具协议、改善错误结构、补充恢复状态、改变上下文策略，或者把稳定经验沉淀为 Skill。

一个比较合理的优化顺序是：

```text
运行时、工具和环境
        ↓
Prompt 和上下文策略
        ↓
经验记忆
        ↓
可复用的 Skill
```

能通过代码、状态机、schema、权限或 verifier 保障的事情，不应只写成一条自然语言规则。Prompt 仍然重要，但它本质上是一种概率性约束；Harness Engineering 的价值之一，就是把反复出现的概率性失败变成结构性保障。

这要求系统同时具备几类观测指标：

- 工程指标，例如缓存命中率、压缩次数、恢复次数和重复工具调用率；
- 模块指标，例如摘要事实保留率、召回准确率和 verifier 命中率；
- 业务指标，例如任务完成率、交付物正确率和人工接管率。

Trace 让我们看见发生了什么，评测让我们知道一次修改是否真的变好。两者结合，Harness 才具备持续演进的闭环。

## 回到 Forge Next

从这个新视角回看 Forge Next，原有的一些机制可以获得更完整的解释：

- `change transactions` 不只是记录改动，也是任务检查点和恢复边界；
- `project-aware verifier` 不只是运行测试，而是在实现领域化的反馈协议；
- `focused test selection` 是用有限成本获取足够有力的验证证据；
- `failure triage` 是把原始错误转化为下一轮可使用的 observation；
- `change review gate` 是把“模型认为完成”提升为“系统有证据确认完成”。

接下来更值得建设的，可能不是继续增加工具数量，而是让这些机制组成一个更完整的长任务控制系统：明确状态机和 checkpoint，保证恢复过程幂等，管理 Context 生命周期，识别无进展循环，并为每项机制建立可复现评测。

## 结语

我之前把 Harness 理解为“让 LLM 成为 Agent 的工程层”。这个理解回答了模型如何接触世界、如何行动，以及如何被约束。

现在我想再补充一句：

> Harness 还是让 Agent 在有限注意力、真实故障和长期执行中保持连续性与可靠性的控制系统。

前一个定义强调连接：把世界、模型和动作连成循环。

后一个定义强调运行：让这个循环不会因为一次错误、一次压缩或一次进程中断就失去目标。

Agent 能否开始行动，取决于模型是否跨过能力门槛。Agent 能否长期可信地完成任务，越来越取决于 Harness 是否把验证、状态、恢复和演进做成了系统能力。

## 参考资料

- [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)，Anthropic，长任务的增量执行、跨会话交接与进度保持；
- [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)，Anthropic，上下文污染、压缩、结构化笔记与信息召回；
- [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)，Anthropic，Agent Eval、Transcript、Outcome 和 Grader 的系统定义；
- [Unrolling the Codex agent loop](https://openai.com/index/unrolling-the-codex-agent-loop/)，OpenAI，Agent Loop、工具调用与自动上下文压缩；
- [Unlocking the Codex harness: how we built the App Server](https://openai.com/index/unlocking-the-codex-harness/)，OpenAI，Thread 生命周期、事件持久化与 Harness 协议；
- [Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/)，OpenAI，长时间 Coding Agent 的验证、反馈和工程环境建设；
- [Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)，LangGraph，Checkpoint、故障恢复与 Pending Writes。
