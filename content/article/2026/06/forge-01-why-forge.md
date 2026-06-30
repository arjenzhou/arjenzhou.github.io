---
title: "Forge 开发笔记 01：为什么要把 Agent 拆开来教"
date: '2026-06-20'
weight: 1
categories:
    - AI
---

最近这段时间，Coding Agent 已经从一个很酷的演示，变成了很多开发者日常工作流的一部分。我们把需求交给它，让它读代码、改文件、跑测试、修报错，甚至继续拆任务给别的 agent。

表面上看，这像是一次模型能力的跃迁；但真正使用久了以后会发现，决定体验好坏的往往不是某一次回答有多聪明，而是它背后那套运行机制是不是可靠。

这也是我做 Forge 的原因。

Forge 不是为了再造一个生产级 Coding Agent。它更像一个教学用的剖面模型：把 agent 的核心结构拆开，做成足够小、足够清楚、可以本地运行、可以观察每一步的系统。

理解 Forge 不适合一上来扎进源码。更自然的顺序是：先理解 Agent 系统为什么需要这些部件，再看 Forge 如何把这些部件压缩成最小实现。

如果只看 README，可以先抓住这条主线：

```text
Task
 ↓
Agent Runner / Loop
 ↓
Context Builder
 ↓
Model
 ↓
Tool Executor
 ↓
Trace & Evaluation
```

这条链路先说明原理：Agent 不是一次模型调用，而是一个持续运行的闭环。任务进入系统以后，runner 负责推进；context 负责整理模型能看到的信息；model 负责做下一步决策；tool executor 把决策变成动作；trace 和 evaluation 再把过程变成可观察、可验证的材料。

等这个分工成立以后，再去看源码才不空。对应到 Forge，大概是这样：

```text
forge/runner.py    # 推进 agent loop
forge/context.py   # 管理 message history，编译模型上下文
forge/model.py     # 真实模型或 MockModel
forge/tools.py     # 工具注册、schema、执行
forge/trace.py     # 记录每一步
forge/verifier.py  # 判断任务是否真的完成
forge/sandbox.py   # 限制文件和命令边界
```

也就是说，代码不是文章的起点，而是设计推导出来的落点：先问这个机制为什么出现，再看 Forge 用哪个最小实现把它落下来。

# 从“会用”到“看懂”

很多人已经会用 Agent，但不一定看懂 Agent。

会用，意味着你知道如何写一个任务描述，知道什么时候让它继续，知道失败时重新提示它。看懂，则意味着你能回答这些问题：

- 它为什么会知道该读哪个文件？
- 它为什么能调用工具，而不是只输出一段文字？
- 它怎么判断自己完成了？
- 如果它说完成了，但测试没过，系统应该怎么办？
- 长任务跑到一半断掉，状态保存在哪里？
- 上下文越来越长，哪些内容应该留下，哪些应该折叠？
- 外部工具、技能包、多 agent 协作应该怎样接进来？

这些问题听起来像实现细节，但它们其实决定了 Agent 是否可观察、可调试、可信任。

Forge 的做法，是把这些问题拆成十个小版本：

```text
v0.1  最小 Agent Loop 和 7 个核心编码工具
v0.2  Verifier gatekeeper 和自我修复循环
v0.3  Task Suite 和隔离 workspace
v0.4  Checkpoint 和 Resume
v0.5  Planning / Replanning
v0.6  Context Compiler
v0.7  Sandbox 和执行边界
v0.8  MCP stdio client
v0.9  Skill Bundle
v0.10 Subagents
```

这条演进线不是为了堆功能，而是在回答一个更朴素的问题：如果从零开始搭一个 Agent，哪些能力必须一层一层出现？

# 第一眼应该看哪里

如果你要打开 Forge 代码，我建议不要从所有类开始扫，而是先跑一个 demo：

```bash
python examples/demo_mock.py
```

这个 demo 会临时创建一个有 bug 的 `main.py` 和一个 `test_main.py`，然后让 `MockModel` 通过工具完成一次修复。入口代码很短：

```python
mock_model = MockModel()
runner = AgentRunner(model=mock_model)

task = (
    "Fix the division by zero bug in main.py so that it raises ValueError, "
    "verify with test_main.py, and inspect git diff."
)

trace = runner.run(task, max_iterations=6)
trace.save_to_file("mock_trace.json")
trace.print_summary()
```

这段代码已经把 Forge 的核心对象串起来了：

- `MockModel` 提供确定性的模型行为；
- `AgentRunner` 推进循环；
- `task` 是用户目标；
- `trace` 是可复盘的执行记录。

真实模型当然更接近生产环境，但最初看系统结构时，mock 反而更好。因为模型行为固定，你看到的变化就主要来自 agent loop、工具执行和 trace。

# Agent 教育不该只教 Prompt

过去一段时间，很多 AI 教程都停留在 prompt 技巧：如何写角色、如何给背景、如何约束输出格式。这些当然有用，但如果只停在这里，很容易形成一种错觉：Agent 的能力主要来自“更会说话”。

可真正的 Agent 系统不是靠一段 prompt 撑起来的。

它需要工具协议，才能从“回答问题”变成“执行任务”；需要验证器，才能避免模型自己宣布胜利；需要 trace，才能复盘每一步为什么发生；需要上下文编译器，才能在长任务里保住关键信息；需要 sandbox，才能让本地执行有边界；需要技能系统和 MCP，才能持续扩展；需要 subagents，才能把复杂任务拆给不同角色并行处理。

Forge 想拆开的，正是这套结构。

当你再去看 Codex、Claude Code、Gemini CLI、OpenHands 或任何别的 Agent 工具，看到的就不只是界面和输出，而是它背后那些熟悉的结构：loop、context、tool、trace、verifier、sandbox、skills、subagents。

这就是 Forge 的出发点：把魔法还原成工程，把工程重新变成可以学习的东西。
