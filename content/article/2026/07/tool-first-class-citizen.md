---
title: "Tool 是 Agent 的一等公民"
date: '2026-07-06'
categories:
    - AI
---

上一篇讲 harness 时，我把它定义成 LLM 之外的 agent 工程系统。

沿着这个定义继续往下看，最容易被低估的部分其实是 tool。

很多人谈 tool，还是把它当成“给模型调用的函数”。这个理解可以跑通最小 demo，但很难支撑一个真正可用的 agent runtime。

因为 tool 不只是执行动作。它定义了模型能怎样进入世界。

模型读代码、改文件、跑测试、看 diff、请求 review、记录经验、准备 commit，这些都不是单纯的“函数调用”。它们是模型和工程环境之间的正式接口。

所以这篇想讲一个判断：在 Agent 系统里，tool 应该是一等公民。

> 这篇文章基于 [baomi-app/forge-next](https://github.com/baomi-app/forge-next) 截至 [8506deb](https://github.com/baomi-app/forge-next/tree/8506deb7c9acd88ea1cfe4ac092d4a8a693b62d5) 的代码，对应 `v0.31.0-issue-pr-workflow-integration`。这条历史把 tool 从本地代码操作，一路推到 issue / PR / CI / review 这些外部协作入口。

# Tool 不只是函数

很多最小 Agent demo 里，tool 看起来就是一组 Python 函数：

```text
read_file
write_file
run_command
search_code
```

这没有错。最小闭环里，tool 的确可以先从函数开始。模型决定要做什么，runner 把 tool call 转成函数调用，再把字符串结果塞回上下文。

但如果 Agent 要进入真实软件工程任务，tool 很快就不能只是函数。

因为 tool 不只是在“执行一个动作”。它同时在定义：

- 模型能看见什么能力；
- 模型怎样表达行动意图；
- 系统允许这个行动访问哪些运行时资源；
- 行动结果如何返回给模型；
- 结果如何进入 trace、journal、review、verifier；
- 失败、阻塞、审批、权限问题如何被表达；
- 副作用如何被审查、回滚或提交。

如果这些都靠字符串约定，很快就会失控。

一等公民的意思是：tool 应该有自己的边界、协议、状态和生命周期。它不是 runner 里的辅助函数，也不是 prompt 后面的附录，而是 agent runtime 的核心对象。

# Tool 是模型看见世界的菜单

模型不会直接知道自己能做什么。它看到的是 tool schema。

这意味着 tool 的名字、描述、参数、必填项、返回格式，都会影响模型的决策。

一个含糊的工具会让模型乱猜。一个太底层的工具会让模型把精力花在机械步骤上。一个太宽泛的工具会让系统很难控制权限和副作用。

好的 tool 应该像一个清晰的工作界面：它告诉模型“你可以做这类事”，也暗示模型“这类事应该这样做”。

比如 `inspect_repo_map` 不是简单的 `list_files` 加强版。它表达的是：在读文件之前，先获得一个仓库级地图。模型不必一上来盲读文件，而是先看到文件角色、入口、符号、导入关系、测试关系，再决定下一步。

`plan_edits` 也不是普通的文本生成。它把“修改前先形成可检查的编辑策略”变成一个动作。模型不只是想“我要改代码”，而是被引导去说明目标文件、编辑顺序、风险和验证方式。

`plan_commit` 和 `commit_changes` 更明显。提交不是一个裸的 `git commit` 命令，而是一套围绕 task-scoped changes 的交付协议：先规划提交边界，再检查风险，再 staging，再提交，再验证提交文件集。

这些 tool 的存在，会反过来改变模型的思考方式。

Tool 不只是执行模型已经想好的动作。Tool 也在塑造模型如何理解任务。

# Tool 需要运行时边界

当 tool 只是函数时，最容易发生的一件事是：函数想要什么，就把什么对象塞进去。

比如 runner、session、sandbox、subagent manager、change set、journal recorder、project policy。开始时这样很方便，但系统一长大，tool 就会开始跨层访问整个 runtime。

这会让 tool 变成隐形的全能对象：它表面上是一个小函数，实际上什么都能摸。

Forge Next 在 `v0.24.0-tool-runtime-injection` 里做了一次关键调整：引入 `ToolCapabilities`。

```python
@dataclass
class ToolCapabilities:
    """Narrow runtime capabilities exposed to tools."""

    workspace_dir: str
    sandbox: Optional[Any] = None
    session: Optional[Any] = None
    subagent_manager: Optional[Any] = None
    journal_recorder: Optional[Any] = None
    policy: Optional[ProjectPolicy] = None
```

这个设计的意义不是少传几个参数，而是给 tool 定义运行时边界。

Tool 不应该随便依赖整个 runner。Tool 应该拿到一组窄能力：workspace 在哪里、sandbox 怎么访问、当前 transaction 在哪里、journal 怎么记录、project policy 怎么读取。

这和前一篇说的 harness 是同一件事。Harness 给模型能力，也给工具边界。

一旦有了这个边界，tool 就更像一个 runtime extension point。它不是内部实现细节，而是被系统认真管理的接口。

# Tool 结果也应该结构化

早期 tool 往往返回字符串。

字符串对模型友好，但对系统不够。因为系统很难知道这次工具调用到底是成功、失败、阻塞，还是需要人工审批。更难知道错误类型、元数据、可审计信息该放在哪里。

所以 `v0.26.0-structured-tool-result` 引入了 `ToolResult`：

```python
@dataclass
class ToolResult:
    """Structured result produced by a tool execution."""

    content: str
    status: str = "success"
    error_type: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
```

这一步很重要。

对模型来说，`content` 仍然可以是普通文本。模型不需要知道所有系统内部字段。

但对 harness 来说，tool result 不再只是字符串。它有状态，有错误类型，有 metadata，可以进入 trace，可以进入 journal，可以区分成功、错误和阻塞。

这让 tool call 从“函数执行”升级成“可观察事件”。

后面的 human review loop 也依赖这个基础。审批 checkpoint 不是普通成功，也不是异常失败，而是一种 `blocked` 状态：系统暂停，等待人类决定。没有结构化 tool result，这种状态很难干净表达。

# Tool 应该承载工作流，而不只是原子动作

当 tool 成为一等公民以后，它就不必局限在“读文件”“跑命令”这种原子动作。

它可以承载更高层的工作流。

`repo map` 是“理解仓库”的工作流。它把文件角色、入口点、符号、导入关系、测试关联整理成模型可读的地图。

`edit planner` 是“修改前规划”的工作流。它让模型在动手前先形成可检查的策略。

`task journal` 是“长任务记忆”的工作流。它记录计划、决策、工具结果、验证结果和下一步，让 agent 在多轮任务里不只是靠上下文硬撑。

`commit orchestration` 是“交付”的工作流。它从 task transaction 出发，规划 staging、检查风险、创建原子提交，并报告剩余工作区状态。

`worktree orchestration` 是“隔离试验”的工作流。它让 agent 可以为复杂实现路径创建独立分支和 worktree，而不是在当前工作区里直接冒险。

`codebase memory` 是“跨任务学习”的工作流。它把项目约定、架构决策、测试经验和流程知识持久化下来，让下一个任务能读到。

`issue / PR workflow` 是“外部协作输入”的工作流。它把 issue、PR、CI、review comment 这些原本散落在协作平台里的信息，整理成 implementation plan、acceptance criteria、review feedback 和 durable memory。

这些 tool 已经不是简单的命令封装。它们更像 agent 的工作器官。

一个成熟的 Coding Agent，不应该只会“改文件”和“跑测试”。它还应该会定位、规划、记录、审查、提交、隔离、记忆，并理解外部协作上下文。

而这些能力最自然的形态，就是 tool。

# Tool 和 Harness 的关系

如果 harness 是 LLM 之外的 agent 工程系统，那么 tool 是 harness 暴露给模型的操作面。

Context 决定模型看见什么。Tool 决定模型能请求什么。Executor 决定请求如何执行。ToolResult 决定结果如何进入反馈回路。Policy 和 capability 决定 tool 能碰到哪里。Journal、trace、review、verifier 决定 tool 的副作用如何被记录和判断。

所以 tool 不是孤立存在的。

一个 tool 至少处在四个关系里：

- 对模型，它是可见能力；
- 对 runtime，它是受控入口；
- 对环境，它是真实动作；
- 对 harness，它是可观察事件。

这就是“一等公民”的含义。

Tool 不是模型的附属品，也不是 runner 的私有函数。它是模型、runtime 和环境之间的正式协议。

# 为什么这一点重要

如果 tool 不是一等公民，Agent 系统会很容易变成一团胶水代码。

模型调用一个函数，函数偷拿 runner，runner 改 session，session 影响 trace，错误塞成字符串，review 再从字符串里猜状态，journal 又靠关键字判断失败。

短 demo 可以这样写。真正的 agent runtime 不行。

因为一旦 tool 的边界不清楚，很多问题都会跟着变模糊：

- 这个动作有没有权限？
- 这个失败能不能恢复？
- 这个结果是否应该进入 journal？
- 这个工具是否改变了 workspace？
- 这个副作用是否属于当前 transaction？
- 这个动作需要不需要 human review？
- 这个结果能不能作为完成证据？

这些问题都不是模型自己能解决的。它们属于 harness。

而 harness 要回答这些问题，tool 就必须被认真建模。

# 到这里，Tool 已经变成工作界面

到 [8506deb](https://github.com/baomi-app/forge-next/tree/8506deb7c9acd88ea1cfe4ac092d4a8a693b62d5)，`forge-next` 的 tool 系统已经从基础代码操作，扩展到本地开发、交付准备和外部协作。

这段演进说明了一件事：tool 正在从低层动作集合，变成 agent 工作流的表达方式。

一开始，tool 解决的是“怎么让模型读写文件、运行命令、查看结果”。再往后，它开始承载更完整的工程动作：先理解仓库结构，再规划编辑；先记录任务过程，再把验证、review、commit 串起来；先隔离复杂尝试，再把项目经验写进可复用的 memory；最后，把 issue、PR、CI、review comment 这些外部协作信号也接进 agent 的工作流。

模型不只是调用工具完成任务。模型通过工具进入仓库、形成计划、执行修改、读取反馈、沉淀记忆、请求审批、准备交付，并把 issue、PR、CI、review comment 这些外部协作信号纳入自己的工作流。

Tool 是 agent 和世界之间的正式接口。

这也是为什么我认为，在 Agent 系统里，tool 必须是一等公民。
