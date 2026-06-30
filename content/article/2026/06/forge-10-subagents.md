---
title: "Forge 开发笔记 10：从单 Agent 到多 Agent 协作"
date: '2026-06-30'
categories:
    - AI
---

单 Agent 可以完成很多任务，但复杂任务天然会分化出角色。

一个真实的软件任务里，可能同时需要安全审计、代码风格检查、测试验证、架构判断和最终修改。让一个 Agent 串行做完所有事情当然可以，但它会变慢，注意力也容易被拉长。更自然的方式，是让一个 orchestrator 负责统筹，再把子任务委派给专门的 subagents。

Forge 的 v0.10 引入 concurrent Subagents，就是为了展示这个多 Agent 协作模式。

# Orchestrator 和 Specialists

v0.10 的核心工具是 `invoke_subagent`。

父 Agent 可以调用这个工具，创建一个子 runner，并给它一段专门的 system prompt 和任务描述。子 Agent 使用同一个模型引用和 workspace 边界，在自己的 agent loop 里完成任务，然后把结果报告给父 Agent。

`examples/demo_subagents.py` 里模拟了几个角色：

- Orchestrator：统筹任务
- SecurityExpert：检查输入长度和安全问题
- LinterExpert：检查风格和格式问题
- QATester：运行验证

父 Agent 不需要亲自完成所有分析。它可以并发启动 SecurityExpert 和 LinterExpert，让两个子 Agent 分别读代码、产出报告，然后自己汇总结果、修改文件、再请 QATester 验证。

这就是多 Agent 协作的基本形状：父 Agent 分配任务，子 Agent 专注局部，结果回流到父 Agent。

# 为什么要并发

Subagents 的一个直接收益是并发。

安全分析和 lint 分析通常可以同时进行，因为它们都是读文件、产出建议，不需要互相等待。Forge v0.10 在 runner 里把 tool calls 分成两类：

- `invoke_subagent` 可以放进 `ThreadPoolExecutor` 并发执行
- 普通工具调用仍然串行执行

这个区分非常重要。并发不是“能并就全并”。文件修改、命令执行这类操作可能有写冲突或环境副作用，盲目并发会把系统搞乱。Subagent 分析任务更适合并行，因为它们通常是读多写少，最终由父 Agent 统一决策。

Forge 用这个小设计展示了一个真实工程问题：多 Agent 系统不只是多开几个模型调用，还要处理资源竞争。

# 共享模型，隔离上下文

Subagent 不是完全独立的新世界。

在 Forge 里，子 runner 会共享父 runner 的模型引用、sandbox 和锁，但拥有自己的 system prompt、上下文和 trace。这样它既能在同一 workspace 里工作，又不会把自己的全部思考过程直接混进父 Agent 的主上下文。

父 Agent 看到的是子 Agent 的最终报告，而不是每个子 Agent 的所有中间步骤。

这同样是一个教学点。多 Agent 协作不等于把所有上下文倒在一起。每个 agent 应该有自己的任务视角，必要结果再汇总给 orchestrator。否则，多 Agent 很容易变成“多份噪音进入同一个上下文”。

# 协作需要调度策略

v0.10 在 runner 里加入了选择性并发调度。

如果 tool call 是 `invoke_subagent`，runner 可以异步启动；如果是普通工具，比如 `edit_file_block` 或 `run_command`，runner 顺序执行。这个调度策略虽然简单，但它体现了多 Agent 系统的一个基本原则：不同动作的并发安全性不同。

只要 Agent 能调用工具，系统就必须知道哪些动作可以同时发生，哪些必须排队。否则多个 Agent 可能同时修改同一个文件、同时运行互相影响的命令，最后谁也不知道结果是谁造成的。

多 Agent 的难点不只是“让它们说话”，而是“让它们在共享世界里行动”。

# Subagents 是前面能力的组合

v0.10 之所以适合放在系列后段，是因为它建立在前面所有能力之上。

没有 agent loop，子 Agent 无法独立执行；没有 tools，子 Agent 只能聊天；没有 trace，协作过程不可复盘；没有 context 管理，多 Agent 会污染上下文；没有 sandbox，共享 workspace 风险更高；没有 verifier，父 Agent 无法确认最终结果。

Subagents 不是凭空冒出来的新功能，而是前面那些机制组合后的自然结果。

这也是 Forge 版本演进最有意思的地方：从 v0.1 的单 Agent 最小闭环，到 v0.10 的并发委派系统，每一步都在回答一个更高层的问题。

# 多 Agent 不等于更聪明，但更像组织

多 Agent 系统不一定比单 Agent 更聪明。它也可能更慢、更吵、更难调试。但当任务确实需要不同视角时，subagents 提供了一种组织方式。

父 Agent 像项目负责人，子 Agent 像专门角色。每个角色不必知道全部背景，只要完成自己的局部判断，并把结果交回主线。

Forge 的 v0.10 想教的不是“多 Agent 一定更好”，而是“当你真的需要多 Agent 时，协作、隔离、汇总和调度都必须被设计出来”。
