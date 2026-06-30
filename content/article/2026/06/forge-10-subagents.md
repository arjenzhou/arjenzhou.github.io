---
title: "Forge 开发笔记 10：从单 Agent 到多 Agent 协作"
date: '2026-06-29'
weight: 10
categories:
    - AI
---

单 Agent 可以完成很多任务，但复杂任务天然会分化出角色。

一个真实的软件任务里，可能同时需要安全审计、代码风格检查、测试验证、架构判断和最终修改。让一个 Agent 串行做完所有事情当然可以，但它会变慢，注意力也容易被拉长。更自然的方式，是让一个 orchestrator 负责统筹，再把子任务委派给专门的 subagents。

Forge 的 v0.10 引入 concurrent Subagents，就是为了展示这个多 Agent 协作模式。

# 设计思路：多 Agent 是组织问题

多 Agent 不是简单地多开几个模型调用。真正的问题是组织：谁拆任务，谁做局部判断，谁汇总结果，哪些动作可以并发，哪些动作必须串行，多个 Agent 在同一个 workspace 里行动时如何避免上下文污染和写冲突。

Forge v0.10 的设计选择很克制：父 Agent 负责 orchestrate；子 Agent 是有独立 system prompt 和上下文的 runner；分析型 subagent 可以并发；普通文件修改和命令执行仍然串行；最终决策回到父 Agent。

这套设计先说明边界：subagents 适合并发分析，不适合各自随意改同一个世界。

# 代码落点

对应源码：

```text
examples/demo_subagents.py  # orchestrator + SecurityExpert + LinterExpert + QATester
forge/tools.py              # invoke_subagent
forge/runner.py             # 选择性并发调度
```

# Subagent 也是一个 runner

v0.10 的核心工具是 `invoke_subagent`。

在 `forge/tools.py` 里，子 Agent 不是一个特殊对象，而是一个新的 `AgentRunner`：

```python
def invoke_subagent(role: str, task: str, runner=None) -> str:
    if not runner:
        return "Error: Parent runner pointer was not injected."

    from forge.runner import AgentRunner

    sub_runner = AgentRunner(
        model=runner.model,
        system_prompt=(
            f"You are a specialized subagent acting as: '{role}'.\n"
            f"Your task is: '{task}'.\n"
            "Perform your tasks and return a concise summary..."
        ),
        workspace_dir=runner.workspace_dir,
        test_command=runner.verifier.test_command,
        tool_registry=runner.tool_registry,
        model_lock=runner.model_lock,
        tool_lock=runner.tool_lock
    )
```

它共享父 Agent 的模型、workspace、verifier 配置、工具表和锁，但有自己的 system prompt、上下文和 trace。

随后把 sandbox 也绑定到同一个物理工作环境：

```python
sub_runner.sandbox = runner.sandbox

sub_trace = sub_runner.run(
    task=task,
    max_iterations=4,
    checkpoint_path=sub_checkpoint
)
```

这说明多 Agent 协作不是“多个聊天窗口”。每个子 Agent 都是一个完整的 loop，只是任务更窄、角色更明确。

# 为什么要并发

Subagents 的一个直接收益是并发。

安全分析和 lint 分析通常可以同时进行，因为它们都是读文件、产出建议，不需要互相等待。Forge v0.10 在 runner 里把 tool calls 分成两类：

```python
subagent_calls = []
standard_calls = []
for tc in tool_calls:
    func_name = tc.get("function", {}).get("name", "")
    if func_name == "invoke_subagent":
        subagent_calls.append(tc)
    else:
        standard_calls.append(tc)
```

然后只让 subagent 并发：

```python
with ThreadPoolExecutor() as executor:
    for tool_call in subagent_calls:
        future = executor.submit(
            self.tool_registry.execute,
            func_name,
            args,
            sandbox=self.sandbox,
            runner=self
        )
```

普通工具调用仍然串行执行：

```python
for tool_call in standard_calls:
    result = self.tool_registry.execute(
        func_name,
        args,
        sandbox=self.sandbox,
        runner=self
    )
```

这个区分非常重要。文件修改、命令执行这类操作可能有写冲突或环境副作用，盲目并发会把系统搞乱。Subagent 分析任务更适合并行，因为它们通常是读多写少，最终由父 Agent 统一决策。

# Demo 里发生了什么

运行：

```bash
python examples/demo_subagents.py
```

第一轮，Orchestrator 同时启动两个子 Agent：

```text
[Orchestrator] Thinking: Let's spawn SecurityExpert and LinterExpert concurrently.

[Runner] Requesting Tool (Async Launch): invoke_subagent
args: {"role": "SecurityExpert", "task": "Audit main.py buffer safety."}

[Runner] Requesting Tool (Async Launch): invoke_subagent
args: {"role": "LinterExpert", "task": "Audit main.py code formatting."}
```

两个子 Agent 都读 `main.py`，但关注点不同：

```text
[SecurityExpert] Thinking: Let's read main.py to identify overflow vulnerabilities.
[LinterExpert] Thinking: Let's read main.py to analyze PEP8 and string strip format.
```

父 Agent 收到两个报告：

```text
[Subagent 'SecurityExpert' Report]:
Vulnerability Report: Line 3 uses raw 'input()' without length limit.
Recommend capping input using slice boundary, i.e., 'input().strip()[:256]'.

[Subagent 'LinterExpert' Report]:
Linter Report: Code layout has minor format issues.
```

第二轮，父 Agent 统一修改文件：

```text
[Runner] Requesting Tool (Sequential): edit_file_block
args: {"filepath": "main.py", "start_line": 3, "end_line": 3,
       "replacement": "    data = input().strip()[:256]"}
```

第三轮，再委派 QATester 验证：

```text
[Subagent 'QATester' Report]:
QA Report: Bounds verification checks successfully executed.
```

# 共享世界，隔离上下文

Subagent 不是完全独立的新世界。它和父 Agent 在同一个 workspace 里行动，但上下文是分开的。

父 Agent 看到的是子 Agent 的最终报告，而不是每个子 Agent 的全部中间步骤。这一点很关键。多 Agent 协作不等于把所有上下文倒在一起；每个 agent 应该有自己的任务视角，必要结果再汇总给 orchestrator。

否则，多 Agent 很容易变成“多份噪音进入同一个上下文”。

# 多 Agent 不等于更聪明

多 Agent 系统不一定比单 Agent 更聪明。它也可能更慢、更吵、更难调试。但当任务确实需要不同视角时，subagents 提供了一种组织方式。

v0.10 建立在前面所有能力之上：没有 agent loop，子 Agent 无法独立执行；没有 tools，子 Agent 只能聊天；没有 trace，协作过程不可复盘；没有 context 管理，多 Agent 会污染上下文；没有 sandbox，共享 workspace 风险更高；没有 verifier，父 Agent 无法确认最终结果。

Forge 的 v0.10 并不是在证明“多 Agent 一定更好”，而是在说明：当你真的需要多 Agent 时，协作、隔离、汇总和调度都必须被设计出来。
