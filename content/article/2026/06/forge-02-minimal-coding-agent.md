---
title: "Forge 开发笔记 02：最小 Coding Agent 是什么"
date: '2026-06-21'
weight: 2
categories:
    - AI
---

如果要从零解释 Coding Agent，我不会先讲模型，也不会先讲 prompt。我会先讲循环。

因为 Agent 最容易被误解的地方，是把它看成“一次更聪明的模型调用”。但一个 Coding Agent 真正开始工作，是从循环开始的：整理上下文，请模型决定下一步，执行工具，把工具结果放回上下文，然后再次请模型决定下一步。

Forge 的 v0.1 就是为了展示这个最小闭环。

# 最小闭环的设计思路

最小 Coding Agent 至少要回答五个问题。

第一，谁来推进任务？模型只负责给建议，不能自己控制循环，所以需要一个 runner。

第二，模型每一轮能看到什么？用户目标、system prompt、历史工具结果都要被整理成 message，所以需要 context。

第三，模型如何行动？它不能直接读写文件，只能请求调用工具，所以需要 tool registry。

第四，系统如何知道发生过什么？Agent 行为不是一次函数返回，而是一串可复盘步骤，所以需要 trace。

第五，什么时候结束？最小版本里可以先让模型通过“没有 tool calls”表达结束意图，后面的 verifier 再把结束判断收紧。

这五个问题推导出 v0.1 的基本形状：runner 推进循环，context 提供输入，model 产生决策，tools 执行动作，trace 记录过程。

# 代码落点

理解这个分工以后，再看源码就清楚很多：

```text
examples/demo_mock.py  # 最小 demo 入口
forge/runner.py        # agent loop
forge/tools.py         # 7 个核心编码工具
forge/context.py       # message history
forge/trace.py         # 执行记录
```

# Runner 只是调度者

`AgentRunner` 初始化时并没有很多神秘对象。它拿到模型、系统提示、workspace、verifier、sandbox 和工具表：

```python
class AgentRunner:
    def __init__(self, model, system_prompt=None, workspace_dir=".",
                 test_command=None, tool_registry=None, model_lock=None,
                 tool_lock=None):
        self.model = model
        self.system_prompt = system_prompt or DEFAULT_SYSTEM_PROMPT
        self.workspace_dir = os.path.abspath(workspace_dir)
        self.verifier = Verifier(workspace_dir=self.workspace_dir,
                                 test_command=test_command)
        self.sandbox = LocalRestrictedSandbox(self.workspace_dir)
        self.tool_registry = tool_registry or registry
```

这里最重要的不是“模型”，而是职责边界：

- 模型负责决定下一步；
- runner 负责推进循环；
- context 负责保存消息；
- tool registry 负责执行动作；
- verifier 负责判断完成；
- sandbox 负责限制边界。

一个最小 Agent，不是一个大函数，而是一组角色分明的模块。

# 一轮循环发生了什么

在 `run()` 里，runner 每一轮都会做三件事：编译上下文、调用模型、处理工具或结束请求。

关键代码可以压成这样看：

```python
messages = context.get_messages()
tool_definitions = self.tool_registry.tool_definitions

content, tool_calls = self.model.generate(messages, tool_definitions)
step.model_text_response = content

if tool_calls:
    context.add_assistant(content, tool_calls)
    result = self.tool_registry.execute(func_name, args,
                                        sandbox=self.sandbox,
                                        runner=self)
    context.add_tool_result(tc_id, func_name, result)
else:
    is_passed, report = self.verifier.verify()
```

这就是 Coding Agent 和普通聊天的根本区别。

普通聊天到 `model.generate()` 就差不多结束了；Coding Agent 还要处理 `tool_calls`。模型不能直接改文件，它只能声明“我要调用哪个工具，参数是什么”。真正的文件读写、命令执行、patch 应用，都在工具层完成。

# 为什么是 7 个工具

v0.1 的核心工具都在 `forge/tools.py`：

```text
list_files
search_code
read_file
apply_patch
edit_file_block
run_command
git_diff
```

这 7 个工具其实对应了一个开发者修 bug 的基本动作。

先看目录，找到可能相关的文件；再搜索关键词，定位代码位置；读文件理解上下文；修改代码；运行测试或命令验证；最后看 diff，确认自己改了什么。

工具注册也很直接。`@tool` 装饰器把 Python 函数放进 registry，registry 再从函数签名和 docstring 生成给模型看的 schema：

```python
def register(self, func):
    name = func.__name__
    self.tools[name] = func

    sig = inspect.signature(func)
    properties = {}
    required = []

    for param_name, param in sig.parameters.items():
        if param_name in ("self", "cls", "sandbox", "runner"):
            continue
        properties[param_name] = {"type": "string"}
```

注意这里跳过了 `sandbox` 和 `runner`。模型不需要知道这些内部依赖，但工具执行时系统会注入它们。这为后面的 sandbox 和 subagent 铺了路。

# 跑 demo 会看到什么

运行：

```bash
python examples/demo_mock.py
```

你会看到 runner 一轮一轮推进：

```text
[Runner] === Iteration 1 ===
[Runner] Requesting Tool (Sequential): list_files

[Runner] === Iteration 2 ===
[Runner] Requesting Tool (Sequential): read_file

[Runner] === Iteration 3 ===
[Runner] Requesting Tool (Sequential): apply_patch
```

这比“模型会写代码”具体得多。Forge 展示的是：模型在每一轮只能通过有限工具观察世界、改变文件、验证结果。Agent 的能力不是凭空来的，而是由 loop、context、tool 和 trace 共同组成的。

# 最小不是简陋

v0.1 的 Forge 很小，但它已经包含了 Agent 的几个关键边界：模型只负责决策，工具负责行动，runner 负责循环，context 负责记忆，trace 负责观察。

后面所有版本，都是在这个骨架上补能力：验证、评估、恢复、规划、压缩、安全、扩展和协作。

所以理解 v0.1 的意义很重要。因为一旦看懂了这个最小闭环，再复杂的 Agent 系统都可以被拆回这几个问题：

谁在推进循环？谁在整理上下文？谁在执行动作？谁在判断完成？谁在记录过程？
