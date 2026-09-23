# 分组、排序与整理偏好

会话列表支持三种组织方式、两种排序键，均可持久化；分组可拖拽整理，组头可折叠并吸顶。本文覆盖偏好模型、分组几何、拖拽规则与虚拟化。

## 整理偏好（organizeBy / sortBy）

```ts
type OrganizeBy = "grouped" | "project" | "chronological";  // 分组 / 按项目 / 时间线
type SortBy = "created" | "updated";                         // 组内排序键
// 默认: project + updated
```

- 偏好持久化到 localStorage（键如 `zcode-sidebar-task-preferences`），**读取必须逐字段校验**：非法值一律回退默认，不做半信半疑的合并；
- 写入失败（受限浏览器/SSR）静默降级，不得阻断侧栏交互；
- **为什么必须持久化**：这两个设置曾只存在组件 state 里，刷新即回默认，用户以为设置没生效。任何「视图模式」类 UI 状态都要过一遍同样的自查：用户主动设置的展示偏好，重启后必须还在。

## 分组模型

- 分组是**用户亲手整理**的结构（可增删移动），不是按规则自动算出来的——自动分组会让用户的手工整理在数据更新后消失；
- 组有 7 色标识：gray / red / orange / yellow / green / blue / purple（精确色值见 [sidebar-tokens.css](../assets/sidebar-tokens.css) 的 `--pcb-group-*`）；
- 组与行都是扁平 id 引用（`taskKey → groupId`），视图树由 id 关系重建；所有移动操作以「视图操作原语」实现：`moveTaskOverTask / insertTaskAroundGroup / moveTaskToGroupStart / moveTaskToGroupEnd / moveGroupAroundTopLevelNode`，UI 拖拽与右键菜单（移入分组 / 从分组移出 / 移到顶部）共用同一组原语，保证两条入口行为一致；
- 草稿行（新会话）在分组视图中有固定落位规则（置顶组附近），不参与拖拽。

## 几何基线（浅/深色 token 见 sidebar-tokens.css）

| 部件 | 尺寸 |
| --- | --- |
| 组头 | `h-8`，圆角 `8px`，内边距 `pl-1.5 pr-1`，hover 换背景 |
| 组名 | 可点击重命名，截断省略，focus ring 1px |
| 计数徽章 | `min-w-5` 圆角胶囊，`px-1.5`，弱色底 |
| 组内容 | 左缩进 `ml-4` + 左边框竖线（`border-l`）+ `pl-2` |
| 行 | 单行 `h-7`（多行工作流行用 `min-h-7` 纵向列布局），圆角 `8px`，`pl-2.5 pr-1` |
| 行过渡 | `background-color/border-color/color/opacity` 200ms ease-out |

组头展开/折叠：箭头旋转动画 + 组内容高度过渡；折叠的组 id 集合持久化（重启后保持折叠）。**全展开/全折叠**按钮操作整个集合；新行插入到折叠组时自动展开该组（否则用户看不到新会话）。

## 吸顶组头（sticky group header）

- 长列表滚动时组头吸附在列表容器顶部（`position: sticky` 或虚拟列表的 sticky slot）；
- 吸顶头与下一个组头相遇时**推挤让位**（不是简单覆盖），避免后一个头叠在前一个头上；
- 吸顶头保留完整交互（点击折叠、右键菜单）；
- 虚拟化实现时用「sticky header slot」：组头行参与测高与虚拟窗口计算，吸顶偏移 = 容器顶部 padding。

## 拖拽（dnd-kit 或等价库）

- 可拖对象：会话行、组；拖拽中源行 `opacity-0`（本体隐藏），DragOverlay 渲染纯展示副本（`pointer-events-none`、`cursor-grabbing`、阴影 + 边框）；
- Overlay 副本**不挂任何副作用**：不显示确认弹层、不响应点击、不发路径解析 RPC——高频渲染下这些副作用会形成循环或抖动；
- 放置判定：行上放置 = 同组内排序（insert near）；组上放置 = 移入该组；根层级放置 = 移出分组；
- 拖拽期间 hover 动作按钮不显示（canShowHoverActions = !dragOverlay）；
- 触屏：长按起拖，配合 hover:none 媒体查询常显动作按钮（见 row-ui.md）。

## 虚拟化

- 会话多时列表必须虚拟化（上游用自研虚拟滚动 + 组内测高缓存）；
- 行高固定 `h-7`（单行）可直接算；组头 `h-8` 参与总高；
- 虚拟窗口上下 overscan 各 5–10 行；行 key 用稳定会话 id，**禁止用数组下标**——运行层置顶会让下标频繁互换，下标作 key 会引发状态错行（spinner 闪到别的行上）；
- prepend 历史时的滚动锚定见 pi-chat-interactions 的 scroll-following.md。
