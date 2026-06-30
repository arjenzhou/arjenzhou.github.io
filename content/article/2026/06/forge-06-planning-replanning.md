---
title: "Forge 开发笔记 06：Planning 不是玄学，是可编辑的工作界面"
date: '2026-06-25'
categories:
    - AI
---

Agent 的 plan 很容易被写成装饰品。

很多系统会让模型先输出一个计划，看起来很有条理：第一步分析需求，第二步修改代码，第三步运行测试。但真正跑起来以后，计划常常就消失了。模型遇到报错，临时改方向；环境缺依赖，临时绕路；测试失败，临时补丁。最后你再看最初的 plan，已经和真实执行过程没什么关系。

Forge 的 v0.5 想解决的不是“让模型会列计划”，而是让计划在执行过程中持续更新。

源码版本：[arjenzhou/forge@89171e6](https://github.com/arjenzhou/forge/tree/89171e6054a019886b4a16d6a2db270b8f754b51)，对应 `v0.5.0-planning`。

# 设计思路：计划是协作界面，不是开场白

一个有用的 plan 不应该只出现在第一轮。它应该在任务推进时持续反映现实：哪一步完成了，哪一步正在做，哪一步被阻塞了，为什么要加新步骤。

这也是 replanning 的意义。真实开发里，计划经常被测试失败、缺依赖、文件结构、权限边界打断。Agent 如果假装计划没变，用户就很难判断它是在稳步推进，还是已经偏航。把 plan 写成每轮可见的状态界面，可以让任务变化被看见。

在 Forge v0.5 里，这个机制先不做复杂状态机，而是通过输出协议实现：要求模型每轮都给出 Plan / Thought / Action。runner 不解析计划，只把它记录进 trace。

# 代码落点

对应源码：

```text
examples/demo_planning.py  # 缺依赖触发 replanning
forge/runner.py            # 不理解 plan，只记录每轮模型响应
forge/trace.py             # plan/thought/action 进入 trace
```

# Plan / Thought / Action

v0.5 对 system prompt 做了一个结构化升级：要求模型每次输出都遵循三个区块：

```text
Plan:
Thought:
Action:
```

在 `examples/demo_planning.py` 里，第一轮模型输出是：

```text
Plan:
- [/] 1. Scan directory files to locate tests
- [ ] 2. Run the test suite

Thought:
I need to examine the workspace directory to find which python files contain our unit tests.

Action:
Listing files in the workspace.
```

这不是为了让输出更漂亮，而是为了把任务状态放到每一轮 trace 里。用户看到的不只是“我要执行命令”，还包括 Agent 当前认为自己在哪一步。

# Replanning 才是重点

demo 故意创建了一个带无用依赖的测试文件：

```python
with open(os.path.join(workspace, "test_math.py"), "w", encoding="utf-8") as f:
    f.write('''import nonexistent_dependency_abc123
import unittest

class TestSimple(unittest.TestCase):
    def test_ok(self):
        self.assertTrue(True)
''')
```

第二轮 Agent 运行测试，遇到 `ModuleNotFoundError`。第三轮它不只是继续修，而是修改计划：

```text
Plan:
- [x] 1. Scan directory files to locate tests
- [x] 2. Run the test suite (Blocked: missing nonexistent_dependency_abc123 dependency)
- [/] 3. Remove redundant nonexistent_dependency_abc123 import in test_math.py (Replanned step)
- [ ] 4. Re-run test suite
```

这才是 planning 有意义的地方：计划必须被现实编辑。

现实来自文件内容，来自命令输出，来自测试失败，来自缺失依赖。一个好的 Agent 不应该固执执行最初计划，而应该在每轮观察后更新自己的任务地图。

# Runner 并不“理解”计划

有意思的是，Forge 的 runner 并没有专门解析这个 checklist。

在 `forge/runner.py` 里，模型文本只是被记录进 `step.model_text_response`：

```python
content, tool_calls = self.model.generate(messages, tool_definitions)

step.model_text_response = content
if tool_calls:
    step.tool_calls = tool_calls

if content:
    print(f"[Model Thought/Message]: {content.strip()}")
```

也就是说，v0.5 的 planning 主要是协议层的约定：system prompt 要求模型用结构化格式表达状态，runner 把它完整记录进 trace。

这反而是一个很好的最小实现。它先证明“计划作为协作界面”有价值，再考虑更复杂的 plan parser、状态机或 UI。

# 跑出来是什么样

运行：

```bash
python examples/demo_planning.py
```

你会看到计划随着现实变化：

```text
[Runner] === Iteration 2 ===
Plan:
- [x] 1. Scan directory files to locate tests
- [/] 2. Run the test suite

[Runner] Requesting Tool (Sequential): run_command
```

测试失败后，下一轮计划插入了新步骤：

```text
[Runner] === Iteration 3 ===
Plan:
- [x] 1. Scan directory files to locate tests
- [x] 2. Run the test suite (Blocked: missing nonexistent_dependency_abc123 dependency)
- [/] 3. Remove redundant nonexistent_dependency_abc123 import in test_math.py (Replanned step)
- [ ] 4. Re-run test suite
```

最后重新运行测试并通过：

```text
[Runner] === Iteration 5 ===
Plan:
- [x] 1. Scan directory files to locate tests
- [x] 2. Run the test suite (Blocked: missing nonexistent_dependency_abc123 dependency)
- [x] 3. Remove redundant nonexistent_dependency_abc123 import in test_math.py
- [x] 4. Re-run test suite (Passed)
```

# Planning 不是替代执行

一个漂亮的 plan 不能保证代码正确，也不能替代 verifier。Forge 的设计里，planning 只是 agent loop 的一部分。它帮助模型组织行动，帮助用户观察状态，但最终仍然要靠工具执行和验证器确认。

这点很重要。规划只有和工具、反馈、验证、上下文结合起来，才有意义。

v0.5 的核心直觉可以概括成一句话：Agent 的计划必须被现实编辑。答案不是凭空出现的，它是被现实反馈一步步塑形出来的。
