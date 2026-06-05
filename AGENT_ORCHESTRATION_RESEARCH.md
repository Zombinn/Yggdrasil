# Yggdrasil — 缺失能力分析与实现规划

## 当前已实现

| 模块 | 能力 | 状态 |
|------|------|------|
| 引擎检测 | 发现 Hermes / OpenClaw / Claude Code | ✅ |
| Profile 管理 | 列表/呼号/引擎切换 | ✅ |
| Kanban 读取 | 只读看板 | ✅ |
| 模型配置 | API Key / Model / URL | ✅ |
| SSO 实时流 | SSE 事件推送 | ✅ |

## 缺失的核心能力

### 1. 任务编排（写操作）

| 能力 | 说明 | 实现方式 |
|------|------|----------|
| 创建任务 | 从 UI 新建 Kanban 任务 | `hermes kanban create --json` CLI 调用 |
| 分解任务 | 将一个任务拆成多个子任务 | `kanban create --parent` + 编排器 |
| 指派任务 | 指定 assignee | `kanban update --assignee` |
| 取消/重试 | 取消阻塞或失败的任务 | `kanban kill` / `kanban retry` |
| 指定 Agent | 明确指定由哪个 Agent 执行 | assignee 选择器 |

### 2. 工作流引擎

| 能力 | 说明 |
|------|------|
| 可视化工作流 | 拖拽式定义多步骤流程 |
| 步骤编排 | 每个步骤指定 Agent + 指令 + 输入输出 |
| 条件分支 | 基于上一步结果的路由 |
| 人工审批节点 | HITL 节点 |
| 工作流模板 | 预定义常用流程 |

### 3. Agent 配置增强

| 能力 | 说明 |
|------|------|
| SOUL.md 编辑 | 在线编辑 Agent 人格/行为配置 |
| Skill 管理 | 查看/安装/启用/禁用 Skills |
| 工具集配置 | 控制 Agent 可用的 tools |
| 行为规则 | AGENTS.md 编辑 |
| 测试对话 | 在 UI 中直接与 Agent 对话 |

### 4. 执行引擎

| 能力 | 说明 |
|------|------|
| ACP Prompt | 通过 ACP 发送消息并获取流式回复 |
| CLI 执行 | 执行 `hermes kanban` 等 CLI 命令 |
| 结果回显 | 任务执行结果显示在 UI 上 |

## 实现顺序

Phase 1（本次）：任务编排写操作 + Agent 对话测试
Phase 2（后续）：工作流引擎
Phase 3（后续）：SOUL.md/Skill 管理
