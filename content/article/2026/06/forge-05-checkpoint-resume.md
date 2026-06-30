---
title: "Forge 开发笔记 05：Agent 跑到一半断了怎么办"
date: '2026-06-24'
categories:
    - AI
---

短任务可以靠一次运行完成，长任务不能。

只要认真用过 Coding Agent，就会遇到这种情况：任务跑到一半，模型 API 超时；本地进程断掉；电脑睡眠；网络抖动；上下文已经走了好几轮，文件也改了一半。这时候如果系统没有保存状态，用户只能重新开始，然后希望 Agent 能“猜”出前面发生了什么。

Forge 的 v0.4 加入 Checkpoint 和 Resume，就是为了把这种脆弱性补上。

源码版本：[arjenzhou/forge@fe1be4c](https://github.com/arjenzhou/forge/tree/fe1be4c1cb89ac974c258e6d96331012182dafdd)，对应 `v0.4.0-checkpoint`。

# 设计思路：Agent 状态是一等公民

普通函数失败后可以重试，因为输入通常还在，副作用也比较明确。但 Agent 不一样。它的“当前状态”不是一个变量，而是一整段过程：读过哪些文件，调用过哪些工具，哪些工具返回了什么，模型已经做过哪些判断，workspace 里已经发生了哪些修改。

所以 checkpoint 不能只是保存“第几步”。它必须保存足够恢复下一轮决策的材料，尤其是 message history 和 trace。恢复时也不是重新开始，而是把这些材料重新装回 runner，让下一轮模型接着已经发生的上下文继续行动。

# 代码落点

对应源码：

```text
examples/demo_checkpoint.py  # 两阶段 demo：先中断，再恢复
forge/runner.py              # save_checkpoint / load_checkpoint / resume_from
forge/trace.py               # StepTrace 反序列化
```

# Checkpoint 保存什么

Agent 的状态不是一个进度条。它至少包括任务、轮次、system prompt、message history、verifier 配置和 trace。

`forge/runner.py` 里的保存逻辑很直接：

```python
def save_checkpoint(self, filepath, current_iteration, context, trace):
    data = {
        "task": trace.task,
        "current_iteration": current_iteration,
        "system_prompt": self.system_prompt,
        "messages": context.messages,
        "test_command": self.verifier.test_command,
        "trace_steps": [step.to_dict() for step in trace.steps]
    }
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
```

这里最关键的是 `messages` 和 `trace_steps`。

只保存“当前做到第几步”没有意义，因为模型下一轮需要看到前面工具返回过什么、自己说过什么、哪里失败过。Checkpoint 必须保存足够恢复 agent loop 的运行材料。

# Resume 如何恢复

恢复时，runner 会读回 checkpoint，重建 message history 和 trace：

```python
if resume_from and os.path.exists(resume_from):
    data = self.load_checkpoint(resume_from)
    task = data["task"]
    start_iteration = data["current_iteration"]

    context.messages = data["messages"]

    trace = ExecutionTrace(task)
    for step_data in data["trace_steps"]:
        trace.add_step(StepTrace.from_dict(step_data))

    print(f"[Runner] Resuming agent loop from Iteration {start_iteration + 1}...")
```

这让中断后的 Agent 不必重新理解世界。它可以接着之前的上下文继续行动。

# Demo 如何模拟断线

`examples/demo_checkpoint.py` 里有一个 `CheckpointMockModel`。它不是用内部计数器判断步骤，而是根据当前 messages 数量判断自己走到哪里：

```python
msg_count = len(messages)

if msg_count <= 2:
    return "I will list workspace files.", [list_files_call]
elif msg_count <= 4:
    return "I will read main.py.", [read_file_call]
elif msg_count <= 6:
    return "I will patch main.py...", [apply_patch_call]
elif msg_count <= 8 and not self.is_resumed:
    raise RuntimeError("API Connection Lost: Network Timeout.")
```

这个设计很巧：模型对象本身可以是新的，但只要 message history 恢复了，它就能知道任务已经进行到哪里。

demo 分成两段：

```python
runner_1.run(task, max_iterations=6, checkpoint_path=checkpoint_file)

runner_2.run(
    task,
    max_iterations=6,
    resume_from=checkpoint_file,
    checkpoint_path=checkpoint_file
)
```

第一段故意在第 4 轮抛异常；第二段从 checkpoint 接着跑。

# 跑出来是什么样

运行：

```bash
python examples/demo_checkpoint.py
```

第一阶段会在已经改完文件之后崩掉：

```text
[Runner] === Iteration 3 ===
[Runner] Requesting Tool (Sequential): apply_patch
[Checkpoint] Successfully saved session state to checkpoint.json

[Runner] === Iteration 4 ===
!!! [MockModel] CRITICAL ERROR: Simulated API Connection Disconnected !!!
[Runner] Fatal Error calling model: API Connection Lost: Network Timeout.
```

然后 demo 检查 checkpoint 是否存在：

```text
[System Status] Answer: YES (State Preserved!)
```

第二阶段恢复：

```text
[Checkpoint] Successfully loaded session state from checkpoint.json
[Runner] Resuming agent loop from Iteration 4...

[Runner] === Iteration 4 ===
[Runner] Requesting Tool (Sequential): run_command
```

最后 trace 仍然包含完整的 5 步，而不是只记录恢复后的两步。

# Trace 和 Checkpoint 是一对

Checkpoint 解决恢复问题，Trace 解决观察问题。两者看起来用途不同，但在 Agent 系统里经常绑在一起。

如果只有 checkpoint，没有 trace，你可以继续运行，但很难知道之前发生了什么。如果只有 trace，没有 checkpoint，你可以复盘失败，但不能从失败点继续。

v0.4 的核心判断很朴素：Agent 是连续过程。只要是连续过程，就要考虑中断；只要考虑中断，就要设计状态。

Forge 追求的不是“Agent 永远不断”，而是“Agent 断了以后也能知道自己在哪里”。
