---
title: "Forge 开发笔记 09：工具、协议和技能"
date: '2026-06-30'
categories:
    - AI
---

一个 Agent 的能力，不应该只写死在代码里。

v0.1 里 Forge 有 7 个核心工具，足够展示 Coding Agent 的基本动作。但真实使用中，工具会不断变化：今天需要读代码，明天需要查数据库，后天需要调用浏览器、GitHub、邮件、内部系统。再往后，Agent 不只需要新工具，还需要某个领域的工作习惯和规则。

Forge 的 v0.8 和 v0.9 分别引入 MCP 和 Skills，就是为了展示 Agent 能力扩展的两条路径。

# MCP：把外部工具接进来

MCP，也就是 Model Context Protocol，可以理解为一种让 Agent 动态连接外部工具服务的协议。

Forge 的 v0.8 实现了一个 stdio MCP client。它可以启动一个本地子进程，通过 JSON-RPC 2.0 做 handshake，查询远端工具列表，然后把这些工具动态注册进 `ToolRegistry`。

这意味着工具不再必须写在 Forge 自己的代码里。只要外部服务按协议暴露 tool schema 和 call 接口，Agent 就可以发现它、注册它、调用它。

`examples/demo_mcp.py` 里用了一个 mock MCP server，暴露 `calculate_fibonacci` 工具。Forge 启动 server、完成初始化、拉取工具列表，再让模型调用这个动态注册的工具计算 Fibonacci。

这个例子很小，但表达的结构很重要：Agent 的工具世界可以是开放的。

# 动态工具注册

MCP 能工作，关键在于 Forge 的 `ToolRegistry` 不只支持本地函数注册，也支持外部工具注册。

本地工具通过 Python 函数签名和 docstring 生成 schema；MCP 工具则直接使用远端提供的 JSON schema。调用时，registry 里的 callback 会把参数转发给 MCP client，再由 client 通过 stdio 和外部进程通信。

对模型来说，它看到的仍然是一个普通 tool definition。它不需要知道这个工具来自本地函数，还是来自另一个进程。

这就是协议的价值：把能力来源藏在统一接口后面。

# Skills：不只是工具，也是工作方式

v0.9 的 Skills 解决另一个问题：Agent 有时缺的不是工具，而是专业规则。

例如 Git commit。你可以给 Agent 一个 `git_commit_raw` 工具，让它执行 commit；但它还需要知道 commit message 应该符合什么规范。这个规范不是工具参数，而是一种认知规则。

Forge 的 Skill Bundle 用文件夹表达一个技能：

- `SKILL.md` 提供 prompt guidelines
- `scripts/*.py` 提供带 `@skill` 标记的工具函数

`SkillsManager` 扫描 skills 目录，聚合 `SKILL.md` 里的指导语，注入 system prompt，同时动态加载 Python 工具。

这样一个 skill 可以同时改变 Agent 的“想法”和“手脚”：既告诉它应该遵守什么规则，也给它新的可执行动作。

# 技能让自我修复更具体

`examples/demo_skills.py` 里有一个 Git commit expert skill。MockModel 一开始尝试提交 `Added skills bundle loader.`，但这个 message 不符合 Angular commit 规范，于是 skill 工具拒绝。下一轮模型根据 system prompt 里的 GitCommitExpert guidelines 自我修正，改成 `feat: implement local skills bundle library`。

这个 demo 很好地展示了 Skills 的价值。

如果只有工具，没有规则，Agent 可能会反复生成不合规范的输入。如果只有规则，没有工具，Agent 只能口头承诺。Skill Bundle 把二者放在一起：规则进入上下文，检查进入工具执行，失败反馈进入下一轮循环。

# MCP 和 Skills 的区别

MCP 和 Skills 都是在扩展 Agent，但它们解决的问题不同。

MCP 更像外部能力接口。它关注的是如何连接一个工具服务，如何发现 schema，如何调用远端能力。

Skills 更像本地专业包。它关注的是如何给 Agent 注入某个领域的工作方法、约束和辅助工具。

一个偏协议，一个偏知识与行为组合。它们可以独立存在，也可以配合使用：一个 skill 可以告诉 Agent 什么时候用某类 MCP 工具，一个 MCP server 也可以成为某个 skill 的执行后端。

# Agent 能力应该可以热插拔

v0.8 和 v0.9 共同传达了一件事：Agent 不应该是一个固定能力列表。

如果工具和技能都写死在主程序里，系统会越来越臃肿，也很难教学。把外部工具协议化，把专业能力打包成技能，Agent 就变成了一个可扩展的运行框架。

对 Forge 来说，这一步意味着它不再只是“一个会改代码的最小 agent”，而开始展示现代 Agent 系统真正重要的能力：按任务加载工具，按场景加载规则，按需要连接外部世界。
