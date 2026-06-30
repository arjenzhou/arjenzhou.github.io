---
title: "Forge 开发笔记 03：让 Agent 学会被打回重做"
date: '2026-06-22'
categories:
    - AI
---

Agent 最危险的时刻，往往不是它不知道怎么做，而是它以为自己已经做完了。

在普通聊天里，模型说“我完成了”只是一句话；但在 Coding Agent 里，这句话可能意味着系统停止循环、任务结束、代码被交给用户。如果没有外部验证，这个完成状态其实很脆弱。

Forge 的 v0.2 加入 Verifier gatekeeper，就是为了让“完成”变成一个可执行检查，而不是模型自己的声明。

# 设计思路：完成必须经过外部现实

v0.2 的核心原则很简单：模型可以申请完成，但不能批准自己完成。

模型的判断来自上下文和语言生成，它适合提出下一步行动、解释错误、生成补丁。但代码是否能运行、测试是否通过、语法是否正确，这些应该交给更客观的机制。Verifier 就是这个外部现实。

因此 runner 的结束逻辑要改成一个 gate：当模型不再请求工具时，不直接退出，而是先执行 verifier。通过才结束；失败就把报告重新送回上下文，让模型继续修。

# 代码落点

对应源码主要看这几处：

```text
examples/demo_verifier.py  # 故意制造语法错误，再让 verifier 打回
forge/runner.py            # 模型想结束时触发 verifier
forge/verifier.py          # 语法检查和测试命令
```

# 完成状态不能只由模型决定

在 v0.1 里，如果模型不再返回 tool calls，runner 就可以认为任务结束。v0.2 改了这个逻辑：模型可以申请结束，但系统先跑 verifier。

`forge/runner.py` 里最关键的分支是这个：

```python
if not tool_calls:
    is_passed, report = self.verifier.verify()
    if is_passed:
        trace.finish(content or "No final response provided.")
        break
    else:
        context.add_assistant(content, None)
        context.add_user(report)
        step.tool_results.append({
            "tool_call_id": "verifier_check",
            "name": "auto_verifier",
            "content": report
        })
        self.save_checkpoint(checkpoint_path, iteration, context, trace)
        continue
```

这一段把 self-correction 从口号变成了机制：

1. 模型尝试结束；
2. runner 运行 verifier；
3. verifier 失败；
4. 失败报告被加回上下文；
5. 下一轮模型看到错误后继续修。

# Verifier 到底检查什么

`forge/verifier.py` 没有做复杂魔法。它先用 `compile()` 检查 Python 语法，再运行用户给的测试命令：

```python
def verify(self):
    syntax_passed, syntax_errors = self.verify_syntax()
    if not syntax_passed:
        return False, "[VERIFIER FAILED] Syntax verification failed! ..."

    if self.test_command:
        tests_passed, test_output = self.run_tests()
        if not tests_passed:
            return False, "[VERIFIER FAILED] Unit tests failed! ..."

    return True, "[VERIFIER PASSED] All compilation and test checks passed successfully."
```

语法检查的核心也很朴素：

```python
with open(filepath, 'r', encoding='utf-8') as f:
    source = f.read()
compile(source, filepath, 'exec')
```

这恰好说明 verifier 不一定需要聪明。它只要足够客观，就能改变 Agent 行为。

# Demo 里发生了什么

`examples/demo_verifier.py` 里的 `VerifierMockModel` 故意犯错。第三轮它把函数定义里的冒号删掉：

```python
buggy_replacement = "def add(a, b)\n    return a + b"
```

第四轮它不再调用工具，直接宣布完成：

```python
return (
    "I have updated main.py. I am finished with the task!",
    None
)
```

这时 runner 不会直接相信它。运行 demo：

```bash
python examples/demo_verifier.py
```

能看到这样的输出：

```text
[Runner] === Iteration 4 ===
[Model Thought/Message]: I have updated main.py. I am finished with the task!
[Verifier] Running verification checks...
[Verifier] Status: FAILED (Syntax Error)
[Runner] Verifier BLOCKED termination.

Syntax Error in main.py at line 1, col 14:
  def add(a, b)
  Error message: expected ':'
```

下一轮，模型读到 verifier report，又把冒号补回去：

```text
[Runner] === Iteration 5 ===
[Model Thought/Message]: Oops, I introduced a syntax error...
[Runner] Requesting Tool (Sequential): apply_patch
```

最后再次尝试结束，verifier 通过：

```text
[Verifier] Status: PASSED
[Runner] Verifier PASSED! Task complete.
```

# 用户也应该设计 Verifier

这件事会改变人和 Agent 的协作方式。

一个好的 agent task，最好不只有自然语言目标，还应该有可执行验证方式。例如：

- 修复 bug：给出测试命令；
- 实现函数：给出单元测试；
- 修改文档：给出格式检查或 diff 检查；
- 重构代码：给出编译、测试、静态检查。

没有 verifier，用户只能靠读最终回答判断质量；有 verifier，Agent 的完成状态就能被更具体地约束。

可靠系统不是从不犯错，而是犯错以后能被发现、能被反馈、能被修正。Forge v0.2 的重点就在这里：不要害怕 Agent 被打回重做。恰恰是这个被打回的机制，让 Agent 从一次性生成器，变成了可以在现实反馈中迭代的执行系统。
