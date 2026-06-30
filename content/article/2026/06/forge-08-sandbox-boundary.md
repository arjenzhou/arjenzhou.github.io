---
title: "Forge 开发笔记 08：给 Agent 画边界"
date: '2026-06-27'
categories:
    - AI
---

一个能读文件、改文件、跑命令的 Agent，天然需要边界。

如果 Agent 只能聊天，风险主要在内容层面；一旦它能执行本地命令，风险就进入了系统层面。它可能误删文件，访问不该访问的路径，运行长时间卡死的命令，或者尝试联网下载东西。即使模型没有恶意，错误的工具调用也可能造成真实副作用。

Forge 的 v0.7 引入 Sandbox 和执行限制，就是为了把这个问题摆到台面上。

> 源码版本：[arjenzhou/forge@3be6fb9](https://github.com/arjenzhou/forge/tree/3be6fb972087ae27c2c5447c128ebcbf251e5584)，对应 `v0.7.0-sandbox`。

# 设计思路：工具能力必须被授权

Agent 能调用工具，不代表它应该默认拥有无限权限。尤其是 `run_command` 这种工具，既能跑测试，也能删除文件、挂起进程、访问网络。系统必须把“模型请求行动”和“系统批准行动”分开。

Forge v0.7 的目标不是做生产级隔离，而是把最小边界放进执行路径：路径必须在 workspace 内，命令要经过危险模式过滤，子进程要有 timeout，工具执行时由系统注入 sandbox。

这个设计的重点是：边界不是 prompt 里的建议，而是工具执行层的规则。

# 代码落点

对应源码：

```text
examples/demo_sandbox.py  # 危险命令、网络请求、超时命令
forge/sandbox.py          # LocalRestrictedSandbox
forge/tools.py            # 工具通过 sandbox 执行
forge/runner.py           # runner 注入 sandbox
```

# 这不是 hardened sandbox

先说清楚：Forge 的 sandbox 不是生产级安全沙箱，也不是用来运行不可信代码的 OS 级隔离环境。

源码自己也这么写：

```python
class LocalRestrictedSandbox(BaseSandbox):
    """A local execution boundary for path checks, timeouts, and shell-free commands.

    This is not an OS security sandbox. Commands still run as the current user,
    so untrusted code requires a real container or process isolation layer.
    """
```

它更准确的名字，是 local execution boundary。它用一些简单机制限制危险动作：

- workspace path checks；
- 命令关键字过滤；
- 子进程 timeout；
- shell-free command execution；
- 工具层依赖注入 sandbox。

# 路径边界

Coding Agent 最基本的边界是 workspace。

Forge 用 `_validate_path()` 防止工具访问 workspace 外部：

```python
def _validate_path(self, filepath):
    target_path = os.path.abspath(os.path.join(self.workspace_dir, filepath))
    if os.path.commonpath([self.workspace_dir, target_path]) != self.workspace_dir:
        raise SecurityViolationError(
            f"Directory Traversal Denied: Path '{filepath}' is outside sandbox"
        )
    return target_path
```

`read_file()` 和 `write_file()` 都先过这个检查：

```python
def read_file(self, filepath):
    target_path = self._validate_path(filepath)
    with open(target_path, "r", encoding="utf-8") as f:
        return f.read()
```

模型可以请求读某个路径，但 sandbox 负责判断这个请求是否合法。

# 命令边界

`run_command` 是 Coding Agent 最有用、也最危险的工具之一。

Forge v0.7 在 `LocalRestrictedSandbox` 里加了 blocklist 和 timeout：

```python
self.blocked_patterns = [
    r"\brm\s+-[rf]+\b",
    r"\bsudo\b",
    r"\bchown\b",
    r"\bchmod\b",
    r"\bcurl\b",
    r"\bwget\b",
    r"\bsh\b",
    r"/etc/passwd",
]
```

执行命令前先扫一遍：

```python
for pattern in self.blocked_patterns:
    if re.search(pattern, command):
        return f"[Security Error] Execution Blocked: Command contains dangerous pattern '{pattern}'."

argv = shlex.split(command)
res = subprocess.run(
    argv,
    cwd=self.workspace_dir,
    capture_output=True,
    text=True,
    timeout=timeout_seconds
)
```

这里还有两个细节：不用 shell，先 `shlex.split()`；命令在 workspace 里运行，并设置 timeout。

# 工具如何拿到 sandbox

模型看到的 `run_command` 参数只有 `command`，但真实函数签名里还有隐藏参数：

```python
def run_command(command: str, sandbox: Optional[BaseSandbox] = None) -> str:
    if sandbox:
        return sandbox.execute_command(command, timeout_seconds=10)
```

`ToolRegistry.register()` 生成 schema 时会跳过 `sandbox`：

```python
if param_name in ("self", "cls", "sandbox", "runner"):
    continue
```

执行时，runner 再把 sandbox 注入进去：

```python
result = self.tool_registry.execute(
    func_name,
    args,
    sandbox=self.sandbox,
    runner=self
)
```

这让 LLM 看到的是“可调用工具”，系统内部看到的是“带执行策略的工具”。

# Demo 里发生了什么

运行：

```bash
python examples/demo_sandbox.py
```

前几轮 MockModel 会故意尝试危险动作：

```text
[Runner] Requesting Tool (Sequential): run_command
args: {"command": "rm -rf /some/dangerous/path"}
[Tool Output]: [Security Error] Execution Blocked: Command contains dangerous pattern '\brm\s+-[rf]+\b'.
```

接着尝试 `curl`：

```text
args: {"command": "curl -s http://example.com/asset.zip"}
[Tool Output]: [Security Error] Execution Blocked: Command contains dangerous pattern '\bcurl\b'.
```

再尝试一个睡 15 秒的命令：

```text
args: {"command": "python -c \"import time; time.sleep(15)\""}
[Tool Output]: [Timeout Error] Command exceeded execution limit of 10 seconds and was forcefully terminated.
```

这些都被系统拒绝后，Agent 才回到真正任务上：读 `calculator.py`，修复 divide-by-zero，再跑测试。

# 边界不是不信任，是协作前提

给 Agent 画边界，不是因为假设它一定会作恶，而是因为任何自动执行系统都应该有边界。

人类开发者也有边界：权限、代码评审、CI、测试环境、生产审批。Agent 只是把行动速度提高了，所以边界更不能省。

Forge 的 sandbox 很轻，但它明确表达了一个心智：Agent 的能力应该被授权，而不是默认无限。

如果把这套思路扩展到生产系统，就会走向更强的隔离：独立系统用户、容器或虚拟机、网络隔离、allowlist、用户确认、高风险工具分级。Forge 没有一次性做完这些，但它把最小边界放进了执行路径。
