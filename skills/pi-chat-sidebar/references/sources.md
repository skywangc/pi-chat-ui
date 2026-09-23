# 来源记录

本包为自包含参考包，以下来源仅用于溯源与许可合规，不是执行步骤。

## 上游参考

- **上游参考产品**：身份、仓库与提交号见 [ATTRIBUTION](../licenses/ATTRIBUTION.txt)（Apache-2.0）。本包 `assets/sidebar-model.ts` 为其侧栏相关纯函数模块（行指示器判定、运行层判定、相对时间、宽度钳制）的提炼改写：保留全部语义与常量值，命名与组织方式调整以脱离上游类型依赖。
  - 行状态与双索引：`WorkspaceSidebar.tsx`、`v4/taskListRowActivity.ts`、`lib/taskListItemPresentation.ts`、store 的 runtime 状态机
  - 分组与偏好：`lib/sidebarTaskPreferences.ts`、`workspace-grouped-tasks/`（view.ts、task-row.tsx、group-item.tsx、sticky-group-header.tsx、draft-task-row.tsx、task-context-menu-content.tsx）
  - 布局与缩放：`app-shell/WorkspaceShellLayout.tsx` 的宽度常量、键盘缩放与自动收起；`WorkspaceSidebar/WorkspaceSidebarCollapsedRail.tsx`
  - 标题走马灯：`components/TaskTitleOverflowText.tsx`
- **pi 0.86.1**（earendil-works/pi，MIT）：协议事实源。`SessionInfo`、sessions 目录布局、`listSessions` 出自 `packages/coding-agent/src/core/session-manager.ts`；`get_state/get_tree/new_session/switch_session/set_session_name` 出自 `packages/coding-agent/src/modes/rpc/`。本包不复制 pi 源码，仅引用协议事实。

## 实现说明

- references/ 全部为按上游行为整理的新撰文档，不复制上游源码文本；
- 交互样板与截图是按参考参数重建的演示，不是原产品截图。

## 许可

- 本包按 Apache-2.0 分发（见 [LICENSE](../LICENSE)）；
- 上游归属与许可文本见 [licenses/](../licenses/)。复制 `assets/*.ts` 时须保留对应声明。
