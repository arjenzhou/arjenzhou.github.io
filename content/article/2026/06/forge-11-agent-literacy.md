---
title: "Forge 开发笔记 11：Forge 真正在教什么"
date: '2026-06-30'
categories:
    - AI
---

写到这里，Forge 已经从一个最小 Coding Agent，长成了一个带验证、评估、恢复、规划、上下文编译、执行边界、MCP、Skills 和 Subagents 的教学框架。

但如果只把它看成一组功能，就错过了真正重要的东西。

Forge 真正在教的，不是如何实现某个特定 Agent，而是 Agent Literacy。

# Agent Literacy 是什么

过去我们常说 AI Literacy，意思是理解 AI 能做什么、不能做什么，以及如何负责任地使用它。到了 Agent 时代，这个概念需要继续往前走。

因为 Agent 不只是回答问题，它会行动。

它会读文件、写文件、运行命令、调用外部服务、管理长期上下文、把任务拆给子 Agent。用户和开发者需要理解的不再只是“模型为什么这样回答”，还包括“系统为什么这样行动”。

Agent Literacy 至少包括这些能力：

- 看懂 agent loop
- 理解上下文如何影响决策
- 知道工具调用和普通文本输出的区别
- 能设计 verifier 和任务验收标准
- 能用 trace 复盘失败
- 能判断执行边界是否足够
- 能区分 prompt、tool、skill、protocol 的作用
- 能监督多 Agent 协作

Forge 的每个版本，都在拆解其中一部分。

# Prompt 只是入口

这组文章反复强调一件事：不要把 Agent 教育简化成 prompt 教育。

Prompt 很重要。没有清楚的目标和约束，Agent 很难工作。但 prompt 只是入口，不是全部系统。

一个可靠的 Agent 需要 runner 推进循环，需要 context 管理记忆，需要 tool registry 执行动作，需要 verifier 判断完成，需要 trace 记录过程，需要 sandbox 约束边界，需要 skills 注入专业规则，需要 MCP 连接外部世界，需要 subagents 组织复杂任务。

Prompt 可以告诉 Agent “你应该怎么做”，但系统机制决定它“能怎么做”“做错后怎么办”“做到什么程度才算完成”。

Forge 作为教学应用，最想把这件事讲清楚。

# 可观察性是学习的前提

如果一个 Agent 只给最终答案，学习者很难建立直觉。

他们不知道模型看到了什么，不知道工具调用发生了什么，不知道错误如何反馈，不知道上下文如何折叠，也不知道最终结果为什么可信。这样的 Agent 也许能用，但很难教。

Forge 把 trace、demo、mock model、task suite 都放在很显眼的位置，是因为教学系统必须可观察。

可观察并不意味着把所有细节都摊给用户看，而是让关键机制在需要时可以被打开。初学者可以先看流程，高阶用户可以看 trace，开发者可以看代码和版本历史。

一个好的 Agent 教学应用，应该允许人逐层深入。

# 错误是教材，不是污点

Forge 的很多 demo 都故意制造错误：

- 语法错误被 verifier 拦住
- 测试失败触发 self-correction
- 缺依赖导致 replanning
- 巨大日志逼出 context compiler
- 危险命令被 sandbox 拒绝
- 不合规范的 commit message 被 skill 工具打回

这些错误不是为了证明 Agent 很笨，而是为了证明系统如何处理失败。

真实世界里的 Agent 不可能永远一次成功。真正值得教的，是失败如何被捕捉、反馈、修复和复盘。

如果学习者只看成功路径，他们学到的是崇拜；如果他们能看见失败路径，他们学到的是工程。

# Forge 的边界

Forge 不是生产级 Agent 平台。

它的 sandbox 不是 hardened OS sandbox；它的 tool system 是教学实现；它的 MCP client 是最小 stdio 客户端；它的 subagents 用简单线程池演示并发；它的 benchmark suite 也只是小型任务集合。

这些边界不是缺陷，而是设计选择。

Forge 的目标是让核心机制足够清楚，而不是在第一天就覆盖生产系统的所有复杂性。它应该像一台透明发动机模型：你能看到活塞怎么动、能量怎么传递、哪里可能卡住。它不一定能直接装进车里，但它能让你理解车为什么能跑。

# 下一步

如果继续往后做，Forge 可以扩展很多方向：

- 更丰富的任务 suite
- 更严格的权限模型
- 更完整的 MCP 能力
- 可视化 trace viewer
- 教学关卡和交互式练习
- 面向不同角色的 skill library
- 多 Agent 协作的冲突检测和调度策略

但无论功能怎么变，我希望 Forge 保持一个核心原则：把 Agent 的关键机制做得可运行、可观察、可解释。

因为未来的 AI 教育，不应该只教人如何向模型提问。它还应该教人如何理解一个会行动的系统，如何给它边界，如何验证它的结果，如何在失败时和它一起恢复。

这就是 Forge 真正在教的东西。
