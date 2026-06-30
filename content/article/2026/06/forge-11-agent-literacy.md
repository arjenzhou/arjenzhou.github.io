---
title: "Forge 开发笔记 11：Forge 真正在教什么"
date: '2026-06-30'
weight: 11
categories:
    - AI
---

到 v0.10，Forge 已经从一个最小 Coding Agent，长成了一个带验证、评估、恢复、规划、上下文编译、执行边界、MCP、Skills 和 Subagents 的透明框架。

如果只把它看成一组功能，就错过了真正重要的东西。

Forge 真正在教的，不是如何实现某个特定 Agent，而是 Agent Literacy：理解一个会行动的 AI 系统如何被组织、观察、约束和扩展。

# Agent Literacy 不是 Prompt 技巧

Prompt 很重要。没有清楚的目标和约束，Agent 很难工作。但 prompt 只是入口，不是全部系统。

回看 Forge 的代码，Agent Literacy 至少落在这些具体位置：

```text
forge/runner.py   # loop、完成判断、checkpoint、并发调度
forge/context.py  # message history 和上下文编译
forge/tools.py    # tool schema、工具执行、依赖注入、subagent 工具
forge/verifier.py # 外部验收标准
forge/suite.py    # 可复现任务评估
forge/sandbox.py  # 本地执行边界
forge/mcp.py      # 外部工具协议
forge/skills.py   # 规则和工具的本地 bundle
forge/trace.py    # 每一步的可观察记录
```

这些文件合在一起，才构成一个 Agent 系统。模型只是其中一个部件。

一个可靠的 Agent 需要 runner 推进循环，需要 context 管理记忆，需要 tool registry 执行动作，需要 verifier 判断完成，需要 trace 记录过程，需要 sandbox 约束边界，需要 skills 注入专业规则，需要 MCP 连接外部世界，需要 subagents 组织复杂任务。

Prompt 可以告诉 Agent “你应该怎么做”，但系统机制决定它“能怎么做”“做错后怎么办”“做到什么程度才算完成”。

# 从版本演进看系统层次

Forge 的十个版本可以重新整理成四层。

第一层是行动闭环：

```text
v0.1 loop + tools + trace
```

这一层回答：Agent 如何从一次模型调用变成连续行动？

第二层是可靠性：

```text
v0.2 verifier
v0.3 task suite
v0.4 checkpoint/resume
```

这一层回答：Agent 如何被验证、评估，以及在中断后继续？

第三层是长任务能力：

```text
v0.5 planning/replanning
v0.6 context compiler
v0.7 sandbox
```

这一层回答：Agent 如何维护任务状态、管理上下文，并在本地执行时有边界？

第四层是扩展和协作：

```text
v0.8 MCP
v0.9 skills
v0.10 subagents
```

这一层回答：Agent 如何接入外部世界、加载专业规则，并把任务拆给不同角色？

这四层其实也对应了使用 Agent 时应该建立的工程直觉：先有闭环，再谈可靠；先能复盘，再谈长任务；先有边界，再谈扩展；先能组织单 Agent，再谈多 Agent。

# 可观察性是入口

如果一个 Agent 只给最终答案，人很难建立直觉。

你不知道模型看到了什么，不知道工具调用发生了什么，不知道错误如何反馈，不知道上下文如何折叠，也不知道最终结果为什么可信。这样的 Agent 也许能用，但很难理解。

Forge 把 trace 放在很核心的位置。`ExecutionTrace` 记录任务、步骤、耗时和最终响应；每个 `StepTrace` 记录模型文本、工具调用和工具结果。

从 demo 输出里可以看到这种结构：

```text
[Step 3]
  Model Thought/Response:
    I will patch main.py to handle division by zero.
  Tool Calls Requested:
    -> apply_patch(...)
  Tool Results:
    <- apply_patch:
    Success: Applied modification to 'main.py'.
```

这比“Agent 修好了 bug”更有用。它把结果背后的过程摊开了：哪一步读文件，哪一步改文件，哪一步验证失败，哪一步被 verifier 打回。

# 错误是材料，不是污点

Forge 的很多 demo 都故意制造错误：

- `demo_verifier.py` 制造语法错误，让 verifier 打回；
- `demo_planning.py` 制造缺依赖错误，触发 replanning；
- `demo_context.py` 制造巨大日志，让 context compiler 提取 traceback；
- `demo_sandbox.py` 尝试危险命令，让 sandbox 拒绝；
- `demo_skills.py` 使用不合规 commit message，让 skill 工具拦截；
- `demo_checkpoint.py` 模拟 API 断线，让 checkpoint 接住状态。

这些错误不是为了证明 Agent 很笨，而是为了证明系统如何处理失败。

真实世界里的 Agent 不可能永远一次成功。真正值得学习的，是失败如何被捕捉、反馈、修复和复盘。

# Forge 的边界

Forge 不是生产级 Agent 平台。

它的 sandbox 不是 hardened OS sandbox；它的 tool system 是最小实现；它的 MCP client 是最小 stdio 客户端；它的 subagents 用简单线程池演示并发；它的 benchmark suite 也只是小型任务集合。

这些边界不是缺陷，而是设计选择。

Forge 的目标是让核心机制足够清楚，而不是在第一天就覆盖生产系统的所有复杂性。它应该像一台透明发动机模型：你能看到活塞怎么动、能量怎么传递、哪里可能卡住。它不一定能直接装进车里，但它能让你理解车为什么能跑。

# 下一步

如果继续往后做，Forge 可以扩展很多方向：

- 更丰富的 task suite；
- 更严格的权限模型；
- 更完整的 MCP 能力；
- 可视化 trace viewer；
- 交互式练习；
- 面向不同角色的 skill library；
- 多 Agent 协作的冲突检测和调度策略。

但无论功能怎么变，我希望 Forge 保持一个核心原则：把 Agent 的关键机制做得可运行、可观察、可解释。

未来的 AI 教育，不应该只教人如何向模型提问。它还应该教人如何理解一个会行动的系统，如何给它边界，如何验证它的结果，如何在失败时和它一起恢复。

这就是 Forge 真正在教的东西。
