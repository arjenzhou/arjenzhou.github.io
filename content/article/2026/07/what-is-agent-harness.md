---
title: "Harness：LLM 之外的 Agent 工程"
date: '2026-07-01'
categories:
    - AI
---

“Harness”这个词最近越来越常被拿来讨论 Agent。它有一种比较窄的用法：给 Coding Agent 准备一个更适合工作的代码仓库环境，比如项目文档、测试入口、lint 规则、评估任务、`AGENTS.md`、review checklist。

这种用法很实用，但我不认为它是 harness 的核心定义。它更像 harness 在具体项目里的局部落地。

我更认可的定义是：

```text
Agent = LLM + Harness
Harness = LLM 之外、让模型能感知、行动、反馈、受约束的工程系统
```

也就是说，harness 不是“给 agent 用的一些辅助文件”，而是 LLM 之外的 agent 工程层。它把模型的推理接到真实环境里，让模型能看见任务、调用动作、接收反馈、保存状态、遵守权限，并在某个完成标准下停止。

[Anthropic 在讨论 agent evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) 时，把 agent harness，也叫 scaffold，定义成让模型能够作为 agent 行动的系统：它处理输入、编排工具调用、返回结果。它还强调，评估一个 agent，评估的是 model 和 harness 一起工作。

[OpenAI 在拆解 Codex agent loop](https://openai.com/index/unrolling-the-codex-agent-loop/) 时，也把 Codex CLI 里的核心 agent loop 称作 agent 或 harness：这层逻辑负责编排 user、model 和 tools 之间的互动。后续 [Codex harness 文章](https://openai.com/index/unlocking-the-codex-harness/) 进一步把 thread 生命周期、持久化、配置、认证、工具执行、MCP、skills 等都放进 Codex harness 的范围里。

所以我理解的 harness，不是一个松散的比喻，而是一条工程边界：LLM 之外，支撑 agent 行动的那套系统。

# Harness 把意图变成行动

LLM 可以理解任务、生成计划、选择下一步。但“下一步”要落到真实环境里，需要 harness。

以 Coding Agent 为例，一次看起来很自然的修 bug 流程，其实可以拆成两部分：

- LLM 判断应该读哪个文件；
- harness 提供文件读取工具；
- LLM 根据代码判断怎么改；
- harness 把 patch 应用到工作区；
- LLM 决定要跑测试；
- harness 执行测试命令并返回结果；
- LLM 根据失败信息继续修；
- harness 记录 trace、限制权限、保存状态、暴露 diff。

用户看到的是 Agent 在连续行动。但系统内部真正发生的是：模型不断产生意图，harness 不断把意图接到上下文、工具、反馈和边界上。

这也是为什么我不太愿意把 harness 理解成“工具箱”。工具只是 harness 的一部分。真正重要的是工具如何被组织进一个循环：模型能不能看懂工具，工具结果能不能进入下一轮推理，失败能不能被结构化，动作能不能被审计，危险操作能不能被拦住。

# Harness 做三件事

我不想在定义文章里把 harness 过早拆成一张模块清单。真正重要的不是它有多少层，而是它承担什么角色。

在我看来，harness 主要做三件事。

第一，它把世界整理成模型可以理解的上下文。

模型不是直接面对世界。它看到的是被系统选择、压缩、排序之后的信息：任务描述、历史消息、文件片段、文档摘要、错误日志、检索结果、用户偏好、团队规则。Harness 决定哪些东西进入上下文，哪些东西被折叠，哪些信号需要保留到下一轮。

这件事听起来像“提示词工程”，但其实更接近环境建模。一个 agent 在代码仓库里工作时，世界不是整个文件系统，而是当前任务、相关文件、测试结果、git diff、项目约定和历史行动构成的任务环境。

第二，它把模型的意图变成真实动作。

模型会生成计划、判断下一步、选择工具，但动作本身需要 harness 执行。读文件、写文件、跑命令、调 API、打开浏览器、创建工单，这些都是 harness 提供的行动接口。

这里的重点不是“给模型很多工具”，而是把动作设计成可以被调用、可以被观察、可以被恢复的系统行为。工具的参数、返回值、错误格式、副作用、并发规则，都会影响 agent 的可靠性。

第三，它把结果变成反馈，并定义行动边界。

Agent 的能力来自循环。行动之后要有观察：命令退出码、测试失败、diff、页面状态、接口返回、用户确认、审查意见。反馈越结构化，模型越容易修正。

同时，harness 也要定义边界。哪些动作允许自动执行，哪些需要审批；哪些路径可以读写，哪些凭证不能碰；什么时候可以认为任务完成，什么时候必须继续验证。这些都不是附加功能，而是 agent 能进入真实工作流的前提。

所以，harness 不是一堆能力的堆叠，而是一种结构：它把世界交给模型，把模型的意图交给环境，再把环境的反馈交回模型，同时把风险收在边界里。

# Forge Next 是一个小样本

`forge-next` 的演进，正好可以作为一个小样本：一个 agent runtime 如何逐步长出 harness 的形状。

> 后面文章会用 [baomi-app/forge-next](https://github.com/baomi-app/forge-next) 作为具体样本。当前参考版本是 [1179461](https://github.com/baomi-app/forge-next/tree/1179461a942771daba89be9acae725ca2ef1b700)，其中 Forge Next 的 runtime 重组从 [af5a07a](https://github.com/baomi-app/forge-next/commit/af5a07a) 开始。

它不是突然加一个“harness”目录，而是从几个机制上把 agent runtime 拆清楚：

```text
af5a07a  runtime architecture
d255895  change transactions
78ece94  project-aware verifier
0f55b65  change review gate
ad79ada  focused test selection
1179461  verifier failure triage
```

这些名字看起来像功能，但换成 harness 的语言，它们其实分别对应不同层次。

Runtime architecture 是把 agent loop、session、tool executor、completion gate 这些运行时责任拆开，让 harness 不再塞在一个巨大的 runner 里。

Change transactions 是 state 和 observation：系统知道本次任务从哪里开始、改了哪些文件、怎么展示 diff、必要时怎么回滚。

Project-aware verifier、focused test selection 和 failure triage 是 feedback：系统不只是跑测试，而是发现该跑什么、解释失败原因、把修复线索送回下一轮推理。

Change review gate 是 completion：模型的完成声明还要经过改动形状、测试证据、文档信号、提交原子性的检查。

这些都不是 LLM 本身的能力，也不是单纯的 prompt 技巧。它们是让模型能在代码仓库里可靠行动的工程机制。

这就是我说的 harness。

# 为什么这个定义有用

采用广义 harness 定义以后，很多问题会变得更容易讨论。

Agent 不知道该读哪个文件，问题可能在 context 入口。

Agent 修 bug 修偏了，问题可能在 feedback 太晚、错误信息太乱、没有可回滚的任务边界。

Agent 经常改出脏文件，问题可能在 transaction、review gate 和提交形状约束。

Agent 让人不放心，问题可能在 permission、sandbox、approval 和执行隔离。

这些问题不应该被混在一个笼统的“Agent 能力”里。它们分别属于 harness 的不同层。

这也是为什么我认为：

```text
Agent 的通用性更多来自 LLM。
Agent 的领域性主要来自 Harness。
```

同一个 LLM，接入代码仓库、终端、测试、diff 和代码审查，它就是 Coding Agent。接入 CRM、邮件、日程、客户状态、报价规则和合规审查，它就是销售 Agent。接入监控指标、日志、trace、部署系统和 runbook，它就是运维 Agent。

模型可以相同，Agent 的形状却完全不同。差异主要来自 harness 提供了怎样的世界、动作、反馈和边界。

# 真正要开发的是这一层

如果接受这个定义，那么很多 Agent 开发问题都可以重新组织：

- context 如何从聊天记录变成任务环境；
- tools 如何从函数调用变成行动协议；
- session 如何保存运行状态；
- verifier 如何把失败变成自我修复信号；
- transaction 如何让改动可追踪、可回滚；
- review gate 如何让“完成”变成可交付判断；
- sandbox 和 permissions 如何定义行动边界；
- trace 如何让过程可观察、可审计。

这些看起来是 Agent 的功能模块，但从另一个角度看，它们都是 harness 的组成部分。

Harness 是 LLM 之外、让模型成为 Agent 的工程系统。

它把世界整理成上下文，把意图落成动作，把结果变成反馈，把风险收进边界。很多时候，我们说自己在开发 Agent，其实是在开发这一层。
