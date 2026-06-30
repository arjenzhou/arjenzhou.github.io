---
title: "Forge 开发笔记 04：如何评估一个 Agent"
date: '2026-06-23'
categories:
    - AI
---

一个 Agent 跑通一次 demo，并不等于它真的可靠。

我们太容易被一次漂亮的演示说服：模型读了文件，改了代码，测试也绿了，于是系统看起来就“成了”。问题是，Agent 的行为有很强的路径依赖。换一个任务、换一个文件结构、换一个错误类型，它可能就会暴露出完全不同的问题。

Forge 的 v0.3 引入 Task Suite，就是为了让评估从“看一次演示”变成“跑一组可复现任务”。

源码版本：[arjenzhou/forge@e428de4](https://github.com/arjenzhou/forge/tree/e428de423f28df3129fa7dab5b335a4654e53faa)，对应 `v0.3.0-suite`。

# 设计思路：评估要把变量收住

Agent 评估最怕变量混在一起。模型输出会变，文件环境会变，任务描述会变，验证方式也会变。如果所有东西同时变化，一次失败很难解释：到底是模型没理解、工具没执行好、测试设计不清楚，还是上一次运行污染了工作目录？

Task Suite 的设计目标，就是把任务变成一个可重复实验。每个任务都要有固定的初始文件、固定的目标描述、固定的 test command、固定的独立 workspace。这样 pass/fail 才有解释价值。

这套设计先于代码存在。代码只是把“任务 = 初始环境 + 目标 + 验收标准”这件事落成结构。

# 代码落点

对应源码：

```text
examples/run_suite.py  # suite 入口
forge/suite.py         # 任务定义、workspace 准备、批量运行
forge/verifier.py      # 每个任务的最终验收
```

# 一个任务长什么样

`forge/suite.py` 里先定义了一个很小的任务对象：

```python
class CodingTask:
    def __init__(self, name, description, setup_func, test_command):
        self.name = name
        self.description = description
        self.setup_func = setup_func
        self.test_command = test_command

    def setup_workspace(self, workspace_path):
        if not os.path.exists(workspace_path):
            os.makedirs(workspace_path)
        self.setup_func(workspace_path)
```

这里的关键不是类本身，而是任务被拆成了四个部分：

- `name`：任务标识；
- `description`：给 Agent 的自然语言目标；
- `setup_func`：如何准备初始 workspace；
- `test_command`：如何验收结果。

这比“给 Agent 一个 prompt 然后看它表现”更稳定，因为每次运行的初始文件和验收方式都是确定的。

# Suite 里有两个最小 benchmark

v0.3 先放了两个小任务。

第一个是修复除零 bug：

```python
CodingTask(
    name="math_bug_fix",
    description=(
        "Fix the divide-by-zero bug in math_helper.py so that "
        "divide(a, b) raises ValueError when b is 0."
    ),
    setup_func=setup_math_bug,
    test_command="python -m unittest test_math.py"
)
```

第二个是实现 `reverse_words`：

```python
CodingTask(
    name="reverse_words_complete",
    description=(
        "Complete the reverse_words(s: str) function in string_tool.py "
        "so that it reverses the order of words in the string."
    ),
    setup_func=setup_reverse_words,
    test_command="python -m unittest test_string.py"
)
```

任务本身不复杂，但结构重要。Forge 开始有了一个评估框架：不是问“这次看起来怎么样”，而是问“这组任务通过了多少”。

# 隔离 workspace 是评估前提

Task Suite 最关键的代码在 `run_all()`：

```python
for idx, task in enumerate(self.tasks, 1):
    task_workspace = os.path.join(self.base_temp_dir, task.name)

    task.setup_workspace(task_workspace)

    runner = AgentRunner(
        model=model,
        workspace_dir=task_workspace,
        test_command=task.test_command
    )

    trace = runner.run(task.description, max_iterations=max_iterations)

    verifier = Verifier(workspace_dir=task_workspace,
                        test_command=task.test_command)
    passed, report = verifier.verify()
```

每个任务都有自己的目录。Agent 读文件、写文件、跑命令，都被限制在这个 workspace 里。

这不是小细节。如果多个任务共享同一个目录，前一个任务的残留文件、修改结果、缓存状态都可能影响后一个任务。最后看到的 pass/fail，就不再只代表 Agent 能力，而是混入了环境污染。

# 跑出来是什么样

用 mock 模式可以离线跑：

```bash
python examples/run_suite.py --mock
```

输出会先显示每个任务的独立 workspace：

```text
[TaskSuite] Starting Evaluation Run on 2 tasks.
[TaskSuite] Workspace Sandboxing Dir: .../temp_tasks

Running Task 1/2: math_bug_fix
Workspace isolated to: .../temp_tasks/math_bug_fix

Running Task 2/2: reverse_words_complete
Workspace isolated to: .../temp_tasks/reverse_words_complete
```

最后给出汇总：

```text
TASK SUITE BENCHMARK RESULTS
Task Name                      | Status | Steps | Duration (s)
math_bug_fix                   | PASS   | 4     | 0.03
reverse_words_complete         | PASS   | 4     | 0.02
Summary: 2/2 Tasks Passed (100.0% Success Rate)
```

# 评估不是只看最终答案

Task Suite 最直接的指标是通过率，但 Forge 并不只关心 pass/fail。

因为每个任务还会保存 trace：

```python
trace.save_to_file(os.path.join(
    task_workspace,
    f"{task.name}_trace.json"
))
```

这意味着一个任务失败了，我们还能继续追问：

- 它有没有找到正确文件？
- 有没有读测试？
- 修改是否命中了目标？
- 是模型判断错了，还是工具返回不清楚？
- 是上下文缺失，还是执行环境问题？

Task Suite 给结果，Trace 给原因。一个负责告诉你“有没有过”，一个负责告诉你“为什么没过”。

v0.3 是 Forge 演进里的一个分水岭。在它之前，Forge 更像一个最小 Agent 示例；在它之后，Forge 开始像一个小型实验平台：可以定义任务，隔离环境，运行 benchmark，收集结果，复盘 trace。
