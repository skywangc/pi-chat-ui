# 侧边栏布局、宽度与折叠

侧边栏是 shell 布局里的一个可缩放面板：宽度可拖拽/键盘调节并持久化，可折叠成窄轨（rail），会话区过窄时自动收起。本文覆盖几何、缩放交互、折叠行为与无障碍。

## 宽度体系（常量基线）

| 常量 | 值 | 说明 |
| --- | --- | --- |
| 默认宽度 | 264px | 首次打开 |
| 最小宽度 | 264px | 钳制下限（等于默认值，即不可比默认更窄） |
| 最大宽度 | 容器 × 0.5 | 但不低于最小宽度；容器未知时不设上限 |
| 键盘步长 | 16px | ←/− 递减、→ 递增 |
| 自动收起阈值 | 360px | 会话内容区宽度小于该值时收起侧栏 |
| 静止判定窗 | 300ms | 宽度变化停止 300ms 后才判「拖拽结束」并执行自动收起检查 |

钳制函数（见 [sidebar-model.ts](../assets/sidebar-model.ts) 的 `clampSidebarWidth`）：`round(clamp(w, 264, max(264, container × 0.5)))`。

持久化：写入 localStorage（键如 `zcode:workspace-shell:sidebar-width-px`），读取时**必须经过钳制函数**再使用——用户手动改过存储、或窗口尺寸变化后，历史值可能越界。CSS 侧用变量下发：`--workspace-sidebar-panel-width`（面板列宽）与 `--workspace-sidebar-width`（含分隔的总宽），布局用 `width: var(--workspace-sidebar-panel-width, 264px)`，避免 React 重渲染拖拽抖动。

## 拖拽缩放

- 分隔条是独立可聚焦元素，`role="separator"`，带 `aria-orientation="vertical"`、`aria-valuemin/max/now`（随宽度更新），键盘可达；
- pointerdown 记录 `startX / startWidth / pointerId / 容器宽`，pointermove 时 `nextWidth = clamp(startWidth + (x - startX))`，pointerup 结束并持久化；
- 拖拽期间置 `data-resizing="true"`：布局容器禁用过渡动画（`transition-*: none` 或选择器关掉 opacity 过渡），否则宽度追随指针时相邻面板会跟着渐变抖动；
- 释放前不写 localStorage（拖拽是高频路径），pointerup 写一次即可。

## 键盘缩放

分隔条聚焦时（见 `sidebarResizeKeyIntent`）：

| 键 | 动作 |
| --- | --- |
| ← | 当前宽 − 16px |
| → | 当前宽 + 16px |
| Home | 钳到最小宽度 264px |
| End | 钳到当前容器允许的最大宽度 |

每次调整都立即持久化（`persist: true`），并同步更新 separator 的 `aria-valuenow`。侧栏处于折叠态时忽略键盘缩放。

## 自动收起（auto-collapse）

对话内容区是「剩余空间」：侧栏过宽会把会话区挤到不可读。

1. 监听会话内容区宽度（ResizeObserver 或 shell 布局回调）；
2. 内容区宽 < 360px 且侧栏可见 → 收起侧栏（记住触发前的宽度，恢复时还原到收起前的值而非默认值）；
3. 收起判定必须在宽度静止 300ms 后执行：拖拽中的中间态（可能瞬时 < 360px）不触发，否则拖拽过程会被强制吞掉；
4. 手动展开后若空间仍不足，允许用户保留展开态（不与用户对抗），只有再次拖拽/改窗才重新判定。

## 折叠态：窄轨（collapsed rail）

折叠后侧栏变成一条窄轨，只保留一个入口：

- 顶部一条 `h-9` 的标题区（与展开态的头部高度对齐），底部 `border-r border-border` 与主内容分隔；
- 轨内唯一按钮：默认显示产品 logo（`size-5`），hover 时淡出 logo 淡入「展开」图标（`PanelLeftOpen`，`size-4`，绝对定位叠加，`transition-opacity`）；
- 按钮带 tooltip（展示快捷键，如 `⌘B`）与 `aria-label="展开侧边栏"`；
- 折叠/展开状态持久化（随 shell 布局偏好），应用重启后恢复；
- 窄轨宽度与展开态的头部装饰对齐（收起后内容区获得全部剩余宽度，无动画残留）。

## 与 pi 的映射

布局属纯客户端；无协议交互。Tauri 侧注意：`app-region: drag`（若做自定义标题栏拖拽区）要给交互元素显式 `no-drag`，rail 上的 logo 按钮也不例外。
