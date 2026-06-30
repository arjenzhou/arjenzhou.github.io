---
title: "Forge 开发笔记 09：工具、协议和技能"
date: '2026-06-28'
weight: 9
categories:
    - AI
---

一个 Agent 的能力，不应该只写死在代码里。

v0.1 里 Forge 有 7 个核心工具，足够展示 Coding Agent 的基本动作。但真实使用中，工具会不断变化：今天需要读代码，明天需要查数据库，后天需要调用浏览器、GitHub、邮件、内部系统。再往后，Agent 不只需要新工具，还需要某个领域的工作习惯和规则。

Forge 的 v0.8 和 v0.9 分别引入 MCP 和 Skills，就是为了展示 Agent 能力扩展的两条路径。

# 设计思路：能力扩展分成两类

Agent 的能力扩展至少有两种问题。

第一种是“工具从哪里来”。如果工具永远写死在主程序里，系统会越来越臃肿，也很难接入外部服务。MCP 解决的是这个问题：外部进程按协议暴露工具，Agent 动态发现、注册、调用。

第二种是“工作方式从哪里来”。有些能力不只是一个函数，而是一组规则和习惯，比如 commit message 规范、代码审查标准、回复风格。Skills 解决的是这个问题：把 prompt guidelines 和本地工具打包成一个 bundle。

所以 MCP 更偏协议，Skills 更偏领域规则和行为组合。两者都在扩展 Agent，但扩展的维度不同。

# 代码落点

对应源码：

```text
examples/demo_mcp.py       # 启动 mock MCP server，动态注册远端工具
examples/mock_mcp_server.py
examples/demo_skills.py    # 加载本地 skill bundle
forge/mcp.py               # stdio JSON-RPC client
forge/skills.py            # skill bundle loader
forge/tools.py             # register_mcp_tool / register
skills/git_expert/SKILL.md
```

# MCP：把外部工具接进来

MCP，也就是 Model Context Protocol，可以理解为一种让 Agent 动态连接外部工具服务的协议。

Forge 的 `MCPClient` 做了三件事：

```python
client.connect([sys.executable, server_path])
client.initialize()
tools = client.list_tools()
```

底层是一个 stdio 子进程。`forge/mcp.py` 里启动 server 后，开线程持续读取 stdout：

```python
self.process = subprocess.Popen(
    command,
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    bufsize=1
)

self.listener_thread = threading.Thread(target=self._listen_loop, daemon=True)
self.listener_thread.start()
```

每次请求都用 JSON-RPC 2.0，靠 request id 把响应配回来：

```python
req = {
    "jsonrpc": "2.0",
    "id": req_id,
    "method": method,
    "params": params or {}
}

self.process.stdin.write(json.dumps(req) + "\n")
success = event.wait(timeout=timeout)
```

这让 Agent 不需要把所有工具都写在自己进程里。

# 动态注册远端工具

MCP server 返回工具列表后，Forge 会把它们注册到 `ToolRegistry`：

```python
def register_mcp_tool(self, name, description, input_schema, execute_callback):
    self.tools[name] = execute_callback
    self._upsert_definition(name, {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": input_schema
        }
    })
```

对模型来说，这个远端工具和本地 Python 函数没有区别。它看到的仍然是普通 tool definition。

运行：

```bash
python examples/demo_mcp.py
```

会看到：

```text
[Demo Setup] Handshake successful! Server Info:
{'name': 'fibonacci-mcp-server', 'version': '1.0.0'}

[Demo Setup] Remote tools exported: ['calculate_fibonacci']
[Tool Registry] Dynamically registered external MCP tool: 'calculate_fibonacci'
```

然后模型直接调用远端工具：

```text
[Runner] Requesting Tool (Sequential): calculate_fibonacci with args: {"n": 10}
[Tool Output]: The 10-th Fibonacci number is 55.
```

这就是协议的价值：把能力来源藏在统一接口后面。

# Skills：不只是工具，也是工作方式

MCP 解决“外部工具怎么接进来”，Skills 解决另一个问题：Agent 有时缺的不是工具，而是专业规则。

比如 Git commit。你可以给 Agent 一个 `git_commit_raw` 工具，但它还需要知道 commit message 应该符合什么规范。这个规范不是工具参数，而是一种工作方式。

Forge 的 skill bundle 用文件夹表达一个技能：

```text
skills/git_expert/
  SKILL.md
  scripts/git_tool.py
```

`SkillsManager` 会先读 `SKILL.md`，把规则拼进 system prompt：

```python
skill_md_path = os.path.join(bundle_path, "SKILL.md")
with open(skill_md_path, "r", encoding="utf-8") as f:
    md_content = f.read()
combined_prompts.append(f"=== Skill: {item} ===\n{md_content}\n")
```

然后扫描 `scripts/`，把带 `@skill` 标记的函数注册成工具：

```python
for name, attr in inspect.getmembers(module):
    if inspect.isfunction(attr):
        if getattr(attr, "is_skill", False):
            registry.register(attr)
            loaded_tools.append(name)
```

这样一个 skill 可以同时改变 Agent 的“想法”和“手脚”：既告诉它应该遵守什么规则，也给它新的可执行动作。

# Skill demo 里发生了什么

运行：

```bash
python examples/demo_skills.py
```

启动时会加载两个 bundle：

```text
[Skills Manager] Discovered Skill Bundle: 'polite_reply'
[Skills Manager] Loaded prompt guidelines from polite_reply/SKILL.md
[Skills Manager] Discovered Skill Bundle: 'git_expert'
[Skills Manager] Loaded custom tool 'git_commit_raw'
```

第一轮，模型尝试用不合规 message 提交：

```text
git_commit_raw({"message": "Added skills bundle loader."})
```

工具拒绝它：

```text
[Security/Lint Error] Git Commit Blocked:
Message 'Added skills bundle loader.' violates Angular specifications.
It must match the regex prefix/lowercase rules:
'^(feat|fix): [a-z].*[^.]$'
```

下一轮，模型根据 prompt 里的规则修正：

```text
git_commit_raw({"message": "feat: implement local skills bundle library"})
```

工具通过：

```text
[Success] Changes committed successfully to repository with message:
'feat: implement local skills bundle library'
```

如果只有工具，没有规则，Agent 可能会反复生成不合规范的输入。如果只有规则，没有工具，Agent 只能口头承诺。Skill Bundle 把二者放在一起：规则进入上下文，检查进入工具执行，失败反馈进入下一轮循环。

# MCP 和 Skills 的区别

MCP 和 Skills 都是在扩展 Agent，但它们解决的问题不同。

MCP 更像外部能力接口。它关注的是如何连接一个工具服务，如何发现 schema，如何调用远端能力。

Skills 更像本地专业包。它关注的是如何给 Agent 注入某个领域的工作方法、约束和辅助工具。

一个偏协议，一个偏知识与行为组合。它们可以独立存在，也可以配合使用：一个 skill 可以告诉 Agent 什么时候用某类 MCP 工具，一个 MCP server 也可以成为某个 skill 的执行后端。

v0.8 和 v0.9 共同指向了一件事：Agent 不应该是一个固定能力列表。把外部工具协议化，把专业能力打包成技能，Agent 才更像一个可扩展的运行框架。
