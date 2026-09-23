# pi 会话数据映射

侧边栏的会话列表、状态与操作在 pi 0.86.1 上的落地方式。与上游的差异点都集中在这一层：上游的 sessions-index / tasks-index 是它自家服务的能力，pi 客户端需要自行组装等价数据线。

## pi 侧有哪些可用

### 会话文件布局

- 会话以 **JSONL 追加树**存储：`~/.pi/agent/sessions/<encoded-cwd>/*.jsonl`；`<encoded-cwd>` 把工作目录编码为 `--path-with-dashes--` 形式（`/`、`:`、`\` → `-`）；
- 每个文件是一个会话的 entry 树（entry 有 id/parentId，leaf 指针定位当前位置），文件内含 `session_info` entry 保存用户命名；
- 文件名即时间序，`ls` 倒序 ≈ 最近修改在前。

### SDK 能力（Node 侧 / sidecar）

`SessionManager` 导出的列表能力（上游 `listSessions`）：返回 `SessionInfo[]`：

```ts
interface SessionInfo {
  path: string;          // JSONL 路径
  id: string;            // 会话 id
  cwd: string;           // 启动目录（老会话可能为空串）
  name?: string;         // 用户命名（session_info entry）
  parentSessionPath?: string;  // fork 来源
  created: Date;
  modified: Date;
  messageCount: number;
  firstMessage: string;  // 首条消息文本（无命名时的标题来源）
  allMessagesText: string;
}
```

- 并发构建 + 分批进度回调（大目录可先渲染部分列表再补全），按 modified 排序；
- **这就是侧边栏成员线的数据源**：`name || firstMessage` → 标题；`modified` → updatedAt/相对时间；`parentSessionPath` → fork 占位文案。

### RPC 能力（当前会话）

| RPC | 侧边栏用途 |
| --- | --- |
| `get_state` | `isStreaming` / `isCompacting` / messageCount / sessionId / sessionFile —— **实时 phase 的唯一权威** |
| `get_tree` | 当前会话的分支树 + leafId（会话内分支 UI，非列表） |
| `new_session` | 「新会话」/ 草稿行激活 |
| `switch_session` | 点击列表行切换会话 |
| `set_session_name` | 重命名菜单项 |
| `prompt / abort` | 行内「运行中」的来源与终止 |

## 差异与组装方案

pi **没有** RPC 列出全部会话的命令（SDK 有）。三种组装路线，按项目形态选择：

1. **Node sidecar**：Tauri 起一个 Node 进程常驻跑 pi SDK，`listSessions` + 文件 watch 推送成员线变更（推荐，语义与上游最接近）；
2. **Tauri fs 扫描**：Rust 侧扫 sessions 目录 + 解析 JSONL 头部（读首个 `session_info`/首条 user message + 文件 mtime），轻量但要自己处理编码目录与并发；
3. **纯 RPC + 单会话**：只展示当前 cwd 已打开过的会话（客户端自己记 sessionId→路径映射），功能最少。

## 实时活动线（phase / attention）怎么来

- `phase`：由 RPC 事件流推导——`agent_start` → running，`agent_end`（成功）→ completedSuccess，错误 → error；`isStreaming`（get_state）为真 ⇒ running。**app 启动时对所有已知会话置「无活动」**，绝不信历史落盘的 running（见 session-list.md 指示器规则）；
- `pendingInteractions`：来自工具调用事件（请求授权 / 提问挂起）与对应 resolve 事件，客户端维护计数（permissionCount / userInputCount），interactionId 去重；
- `hasBackgroundWork`：pi 下对应后台 bash（`bash` RPC + 进行中标志）与扩展子代理活动；
- 切换会话时：旧会话 phase 冻结为最终已知值，新会话以 `get_state` 拉实时值，不共享状态。

## 成员操作映射

| 侧边栏操作 | pi 侧 |
| --- | --- |
| 重命名 | `set_session_name`（写 session_info entry） |
| 切换会话 | `switch_session`（或对草稿行先 `new_session`） |
| 删除会话 | pi 无 RPC；客户端删 JSONL 文件（Tauri fs），同步移除列表行与草稿键 |
| 未读 / 分组 / 置顶 / 归档 | **纯客户端成员线**（本地持久化，键含 workspace 路径），pi 无对应概念 |
| fork 来源 | `SessionInfo.parentSessionPath` → fork 占位标题 |

## 事件时序注意

- `get_state` 是快照；事件流才是真相。切换到「运行中」会话时先 `get_state` 对齐，再靠事件流增量维护，避免竞态窗口显示「已完成」；
- 成员线（本地扫描）与活动线（RPC 事件）更新频率不同：列表渲染以成员线为骨架，活动线合并进视图模型（见 session-list.md 的 sidecar 语义）；
- 多工作区：按 sessions 目录的 encoded-cwd 天然分区，侧边栏按 workspaceKey 分桶，切换工作区 = 切换桶。
