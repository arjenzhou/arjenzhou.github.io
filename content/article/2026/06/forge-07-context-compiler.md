---
title: "Forge 开发笔记 07：上下文不是越多越好"
date: '2026-06-26'
categories:
    - AI
---

Agent 跑得越久，上下文就越重。

一开始，message history 很清爽：system prompt、用户任务、一次模型输出、一个工具结果。几轮之后，里面开始堆满文件内容、命令输出、测试日志、错误堆栈、模型解释和工具调用参数。再跑久一点，上下文不仅贵，而且会变得吵。

Forge 的 v0.6 引入 Context Compiler，就是为了回答一个问题：长任务里，Agent 到底应该把什么发给模型？

源码版本：[arjenzhou/forge@74dbe17](https://github.com/arjenzhou/forge/tree/74dbe170814093ce93768ce3bf625167a1806621)，对应 `v0.6.0-context`。

# 设计思路：完整历史和当前输入要分开

上下文管理最容易犯的错，是把“保存历史”和“发送历史”混成一件事。完整历史应该保存在本地，用来恢复、审计和复盘；但模型每一轮需要的是当前决策最相关的信息窗口。

所以 Context Compiler 的原则不是“少给一点”，而是“把历史编译成当前可用的输入”。旧的长工具输出可以折叠，最近几轮保留细节，长日志里真正关键的 traceback 要被提取出来。

这套设计推导出两个层次：`Context.messages` 是原始记忆，`get_messages()` 是给模型的编译视图。

# 代码落点

对应源码：

```text
examples/demo_context.py  # 大量噪音日志 + traceback 提取
forge/context.py          # get_messages / _compile_smart_truncation
forge/runner.py           # 每轮调用 context.get_messages()
```

# 原始记忆和模型上下文不是一回事

很多人会把“保存所有历史”和“把所有历史发给模型”混在一起。Forge 刻意把这两件事分开。

`Context` 里保留完整 message history：

```python
class Context:
    def __init__(self, system_prompt=None):
        self.messages = []
        if system_prompt:
            self.add_system(system_prompt)

    def add_tool_result(self, tool_call_id, name, content):
        self.messages.append({
            "role": "tool",
            "tool_call_id": tool_call_id,
            "name": name,
            "content": content
        })
```

这是原始记忆，不能随便丢。Checkpoint 和 trace 都需要它。

但每轮发给模型时，runner 调用的是：

```python
messages = context.get_messages()
content, tool_calls = self.model.generate(messages, tool_definitions)
```

`get_messages()` 会动态生成一个更轻的版本。系统保存完整历史，但模型不一定每次都需要看到完整历史。

# 折叠历史，保留结构

`forge/context.py` 的 history folding 很朴素：

```python
compiled_messages = copy.deepcopy(self.messages)
keep_count = keep_recent_turns * 2
cutoff_index = len(compiled_messages) - keep_count

for idx, msg in enumerate(compiled_messages):
    if idx < cutoff_index:
        if msg.get("role") == "tool":
            original_len = len(msg.get("content", ""))
            if original_len > 150:
                msg["content"] = (
                    f"[Output of tool '{msg.get('name')}' folded..."
                )
        elif msg.get("role") == "assistant":
            if msg.get("content") and msg.get("tool_calls"):
                msg["content"] = "[Thoughts folded]"
```

这不是删除历史，而是给模型一个结构性提示：这里曾经发生过一次工具调用，但细节现在不重要。

最近几轮保留更多细节，较老的长输出折叠。这样上下文仍然有骨架，但不会被旧日志淹没。

# Traceback 是长日志里的黄金

v0.6 最有意思的部分，是 traceback extraction。

测试命令常常会输出大量噪音：初始化日志、连接信息、warning、重复打印。真正对修复有用的，可能只是最后那段 Python traceback。

Forge 的处理逻辑是：

```python
traceback_match = re.search(
    r"(Traceback \(most recent call last\):.*)",
    content,
    re.DOTALL
)
if traceback_match:
    traceback_block = traceback_match.group(1)

    tb_lines = traceback_block.split("\n")
    if len(tb_lines) > 15:
        traceback_block = "\n".join(tb_lines[-15:])

    compiled = head + trunc_msg + "[Extracted Traceback Exception]:\n" + traceback_block
    return compiled
```

这不是简单截断，而是把长输出里最可能影响下一步决策的部分提取出来。

# Demo 里发生了什么

`examples/demo_context.py` 会创建一个缺少 `database_url` 属性的 `Config`，测试文件则故意打印 100 多行数据库连接日志。

运行：

```bash
python examples/demo_context.py
```

第三轮工具输出很长：

```text
[Runner] Requesting Tool (Sequential): run_command
[Tool Output Snippet]: [Stdout]
[Log] Database host 192.168.1.0 connection: PENDING... RETRYING...
```

第四轮开始前，Context Compiler 介入：

```text
[Context Builder] Compiled tool output 'run_command' by extracting Traceback.
Compressed 8803 to 718 chars.
```

于是模型下一轮看到的不是 8803 个字符的噪音，而是保留了 `AttributeError` 的压缩上下文：

```text
I see an AttributeError: 'Config' object has no attribute 'database_url'
in the traceback error logs. I will patch main.py to define this attribute.
```

# 上下文管理影响智能表现

有时我们觉得模型“变笨了”，其实不是模型能力突然下降，而是上下文污染了决策。

太多无关信息会分散注意力；太早的错误可能误导当前判断；重复日志会挤掉真正重要的文件内容。Agent 系统如果不管理上下文，就会在长任务里逐渐失去方向。

Context Compiler 的价值，就是在原始历史和模型输入之间加一层编译过程。它像一个过滤器，把完整执行历史转换成当前轮次更可用的 prompt。

Forge 的 Context Compiler 只是一个最小实现，但它打开了一个很重要的问题：Agent 的智能，很大一部分来自它在每一轮到底看见了什么。
