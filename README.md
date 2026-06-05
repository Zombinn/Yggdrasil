# Yggdrasil — Agent 可视化管理与调度平台

> 轻量化本地 Agent 管理桌面应用 — 可视化管理 + 任务调度 + 实时展示

---

## 概览

Yggdrasil 是一个**轻量化、本地优先**的 AI Agent 可视化管理与调度平台。它借鉴了 [Hermes War Room](https://github.com/Naroh091/hermes-war-room) 的架构设计，提供类似 **扣子 Coze** / **腾讯元器** 的 Agent 管理体验，但完全本地运行，隐私优先。

### 核心能力

| 能力 | 说明 |
|------|------|
| **多引擎支持** | 自动检测并使用 Hermes Agent / OpenClaw / Claude Code |
| **实时看板** | 5 列 Kanban 实时更新，SSE 流推送状态变化 |
| **Agent 管理** | Profile 发现、呼号设置、引擎切换、激活/停用 |
| **ACP 连接池** | Hermes ACP 子进程池，60min idle 超时，按需预热 |
| **引擎推荐** | 自动分析系统环境，推荐最优引擎 |
| **任务统计** | 按引擎/Profile 聚合成功率、耗时、Token 消耗 |
| **本地存储** | SQLite 零依赖，数据完全在本地 |

### 支持引擎

| 引擎 | 检测方式 | 版本 | Kanban |
|------|----------|------|--------|
| **Hermes Agent** | `which hermes` / pip | 181k★ | ✅ 完整读取 |
| **OpenClaw** | `openclaw --version` / npm | 377k★ | ❌ |
| **Claude Code** | `which claude` / `which codex` | — | ❌ |

---

## 快速开始

### 前提条件

- **Node.js 22+** (推荐 24)
- 至少一个 Agent 引擎（Hermes / OpenClaw / Claude Code）

### 安装

```bash
# 1. 安装依赖
npm install

# 2. 开发模式运行
npm run dev
# → 浏览器打开 http://localhost:3000

# 3. 生产构建
npm run build
npm run preview
# → 预览生产构建 http://localhost:3000
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `HERMES_HOME` | `~/.hermes` | Hermes Agent 配置目录 |
| `YGGDRASIL_ACP_IDLE_MS` | `3600000` | ACP 连接空闲超时(ms) |
| `YGGDRASIL_ACP_TOOLSETS` | `terminal,skills,todo,memory,clarify,messaging` | ACP 工具集 |

---

## 项目结构

```
yggdrasil/
├── app/                          # Nuxt 4 前端
│   ├── app.vue                   # 根组件 + 导航栏
│   ├── assets/css/main.css       # 全局样式（暗色主题）
│   ├── composables/
│   │   └── useMissionStream.ts   # SSE 流事件管理
│   ├── pages/
│   │   ├── index.vue             # War Room — 实时作战面板
│   │   ├── team.vue              # 团队 — Agent 管理 + 引擎状态
│   │   └── stats.vue             # 统计 — 引擎推荐 + 任务统计
│   └── types/
│       ├── mission.ts            # 任务/消息类型定义
│       └── profile.ts            # Profile 类型定义
├── server/                       # Nitro 后端
│   ├── api/                      # API 路由
│   │   ├── engines.get.ts        # 引擎检测
│   │   ├── engines/default/      # 设置默认引擎
│   │   ├── engines/recommend.get.ts  # 引擎推荐
│   │   ├── kanban/tasks.get.ts   # Kanban 任务读取
│   │   ├── missions*.ts          # 任务对话 CRUD
│   │   ├── profiles*.ts          # Profile 管理
│   │   ├── stats/index.get.ts    # 任务统计聚合
│   │   └── version.get.ts        # 版本信息
│   └── utils/
│       ├── db.ts                 # SQLite 数据库（4 张表）
│       ├── hermes.ts             # Hermes Profile 发现
│       ├── kanban.ts             # Kanban 重导出
│       ├── orchestrator-acp.ts   # ACP 子进程池管理（核心）
│       └── engines/              # 引擎适配层
│           ├── types.ts          # 引擎抽象接口
│           ├── index.ts          # 引擎注册表
│           ├── hermes.ts         # 3 引擎实现
│           ├── kanban.ts         # Kanban DB 读取
│           └── recommend.ts      # 自动引擎推荐
└── nuxt.config.ts
```

**共 37 个源文件，约 1,400 行代码，构建输出 3.4 MB（gzip 870 KB）**

---

## 功能详解

### 1. 引擎适配层

统一接口 `EngineAdapter` 支持三种引擎：

```typescript
interface EngineAdapter {
  id: 'hermes' | 'openclaw' | 'claude-code'
  name: string
  detect(): Promise<EngineDetection>       // 检测可用性 + 版本
  discoverProfiles(): Promise<EngineProfile[]>  // 发现 Profile
  readKanban?(assignee?): KanbanTask[]     // 读取任务
  isDispatcherStale?(): boolean            // 调度器状态
}
```

**引擎检测流程**：
1. 启动时调用 `GET /api/engines` 检测所有引擎
2. `detect()` 执行 `which` / `--version` 检查
3. 可用引擎通过 `discoverProfiles()` 发现 Agent
4. Profile 带 `engine` 标记，可在团队页面切换

**引擎推荐算法**：

| 引擎 | 基础分 | 加分项 |
|------|--------|--------|
| Hermes | 70 | +15 (有kanban.db), +5/Profile (上限15) |
| OpenClaw | 50 | +15 (工作区已配置) |
| Claude Code | 40 | +15 (项目有 CLAUDE.md) |

### 2. ACP 子进程池

参考自 Hermes War Room 的 `orchestrator-acp.ts`，管理 Hermes Agent 的 ACP 子进程：

```
请求 → getEntry(slug) → 池中有? → 返回
                        ↓ 无
                   spawn('hermes -p <slug> -t <toolsets> acp')
                        ↓
                   fixupRawIO() 修复 schema 不匹配
                        ↓
                   PoolEntry { child, sessionEmitters, inFlight }
```

- **Idle 超时**: 60 分钟无活动自动 SIGTERM
- **Reaper**: 每分钟扫描，清理僵尸连接
- **预热**: `warmup(slug)` 页面加载时预启动，避免冷启动 5-15 秒
- **Session 隔离**: 每个 Profile 独立子进程

### 3. War Room 实时面板

```
┌──────────────────────────────────────────────────────┐
│  Yggdrasil  War Room                      [刷新按钮] │
├────────────────────────┬─────────────────────────────┤
│    任务看板 (5列)       │      操作员面板              │
│                        │                             │
│ 待分拣 │ 待处理 │ 就绪   │  ┌─────┐  ┌─────┐        │
│ ───────┼────────┼───────┤  │Avatar│  │Avatar│        │
│ Card 1 │ Card 3 │       │  │name  │  │name  │        │
│ Card 2 │        │       │  │status│  │status│        │
├────────┼────────┼───────┤  └─────┘  └─────┘        │
│执行中  │ 阻塞   │       │  实时 5s 轮询刷新          │
│ ───────┼────────┤       │                            │
│ Card 4 │ Card 5 │       │  正在工作的 Agent 靠前     │
└────────┴────────┴───────┴─────────────────────────────┘
```

- **5 列 Kanban**: `triage → todo → ready → running → blocked`
- **5 秒轮询**: 自动刷新任务状态
- **颜色条纹**: Agent 颜色标记任务卡片
- **智能排序**: 正在运行的 Agent 靠前

### 4. 数据库设计 (SQLite)

```sql
-- 4 张核心表
profiles          -- Agent 信息 (slug, engine, avatar, active)
missions          -- 对话/任务 (orchestrator_slug, title, status)
mission_messages  -- 对话消息 (role, content)
task_stats        -- 任务执行统计 (engine, profile, status, duration, tokens)
```

---

## API 参考

| 方法 | 路由 | 说明 |
|------|------|------|
| `GET` | `/api/engines` | 检测所有引擎可用性 |
| `GET` | `/api/engines/recommend` | 获取引擎推荐评分 |
| `PUT` | `/api/engines/default` | 设置默认引擎 |
| `GET` | `/api/kanban/tasks` | 读取 Kanban 活跃任务 |
| `GET` | `/api/profiles` | 获取所有 Agent Profile |
| `PATCH` | `/api/profiles/:slug` | 更新 Profile (呼号/激活) |
| `PUT` | `/api/profiles/:slug/engine` | 切换 Profile 引擎 |
| `GET` | `/api/missions` | 任务列表 |
| `POST` | `/api/missions` | 创建新任务 |
| `GET` | `/api/missions/:id` | 任务详情 + 消息 |
| `POST` | `/api/missions/:id/messages` | 发送消息 |
| `POST` | `/api/missions/:id/archive` | 归档任务 |
| `GET` | `/api/stats` | 任务统计聚合 |
| `GET` | `/api/config` | 系统配置 |
| `GET` | `/api/version` | 版本信息 |

---

## 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 前端框架 | Nuxt 4 | ^4.4.2 |
| UI 组件 | Nuxt UI | ^4.7.0 |
| CSS | Tailwind CSS | ^4.2.4 |
| 后端 | Nitro (Node.js) | 内置 |
| 数据库 | SQLite | 内置 `node:sqlite` |
| YAML 解析 | yaml | ^2.8.4 |
| 包管理 | npm / pnpm | — |

### 设计理念

遵循 [Karpathy 编程原则](https://github.com/multica-ai/andrej-karpathy-skills)：

1. **先思考再编码** — 每个模块前明确设计决策
2. **保持简单** — 不做需求外的功能，37 个文件解决核心问题
3. **手术式修改** — 参考成熟项目（War Room）做减法
4. **目标驱动** — 每一行代码都可追溯到用户需求

---

## 参考项目

| 项目 | Stars | 参考内容 |
|------|-------|----------|
| [Hermes War Room](https://github.com/Naroh091/hermes-war-room) | 312★ | ACP 子进程池、Kanban 读取、SSE 流、UI 设计 |
| [Hermes Agent](https://github.com/NousResearch/hermes-agent) | 181k★ | Profile 系统、Kanban 任务板、ACP 协议 |
| [OpenClaw](https://github.com/openclaw/openclaw) | 377k★ | Gateway 架构、Skills 系统、跨平台 |
| [ClawManager](https://github.com/Yuan-lab-LLM/ClawManager) | 1.7k★ | Agent Control Plane 设计 |
| [Mission Control](https://github.com/abhi1693/openclaw-mission-control) | 4k★ | 治理审批流设计 |

---

## License

MIT
