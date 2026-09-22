# 视觉与桌面布局

完整色值见 [主题 CSS](../assets/chat-ui-tokens.css)，可复制的组件样式见 [组件 CSS](../assets/chat-ui-components.css)。具体几何参数见 [组件参数](component-recipes.md)。

## 视觉基础

- 原 UI 使用 Tailwind 4、Radix/shadcn、Lucide、Zustand、Streamdown；它们是参考实现，不要求推翻目标项目兼容组件库。
- 紧凑工作台，保持可见面积、对齐、文字密度和背景层次，不添加大渐变、大留白、整块品牌色。
- 活跃主题是 Light / Dark，System 解析到相应主题；CSS 通用 fallback 不是目标主题。
- 基准 `--ui-font-size: 14px`；UI token：xl 18、lg 16、base 14、caption 13、sm 12、xs 10。不能改变 html font-size 缩放整个布局。
- 间距基准 4px，常用 4/8/12/16/20/24；图标默认 16px，按内置组件参数选择 12/14/20/24；控件高常见 24/28/32/36px。
- 常规圆角容器从 xl 开始，嵌套 lg → md → sm；主输入壳、状态浮层、toast 有 2xl 例外；菜单壳 lg、菜单项 md。实际与规范冲突时对照固定画面记录。
- background/sidebar/panel/card/input/popover 有独立 token，不能都替换为一种灰。提取 token 保留其依赖变量。

## 骨架

左侧侧栏 + 中间会话框架 + 可选底部终端 + 可选右侧 Side Pane。会话框架包含 WorkspaceHeader；终端独立；右侧有自己的 tab bar。

- 侧栏默认/最小 264px，最大容器宽度 50%；窄窗口将最大值限制为 max(264px, 容器宽度 × 0.5)，不足以并排阅读时提供收起入口；不硬撑满所有面板。
- 侧栏键盘调整步长 16px，持久化宽度，无效值回退默认。
- 框架间 4px 调整间隙，指示线 2px，hover/focus/drag 显示。Shell 分隔与 v4 内部分屏的 9px 命中区不同，不混为同一数值。
- 保持 min-w-0/min-h-0，横向溢出留在代码/表格内部；会话、侧栏独立滚动。
- 拆分/关闭其他面板不重挂存活会话，保留草稿、选择、测高和滚动。

## Tauri 适配

不保留参考应用的专用 window 全局对象，不把 Electron 的 app-region:drag 当 Tauri 自动可用功能。按目标 Tauri 版本适配拖拽和窗口 API，确保按钮/输入框可交互。

按 OS 核对标题栏安全区、窗口控件、最大化边界、透明效果。Linux 的 16px 外壳/12px 面板/4px inset 不无条件套用到 macOS/Windows。

记录 OS、窗口逻辑尺寸、DPR、缩放、主题、UI 字号；对照截图使用相同条件。
