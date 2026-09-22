# 独立组件参数与状态契约

不需要外部源码。原组件的已确认参数记为“提取”；为便携样板补充的选择记为“样板默认”，后者不是原版截图测量值。所有颜色取 assets/chat-ui-tokens.css，禁止随意重配一套近似灰。

## 基础控件（提取）

原 button 基类实际为 rounded-md（6px），尽管设计规范要求一般控件默认 lg；复刻当前实际组件时保留此差异。字体 base 14px、颜色过渡、透明 1px 边框、禁用透明度 .5。

| 类型 | 高/宽 | padding / gap | 图标 | 圆角 |
|---|---|---|---|---|
| 默认按钮 | 高 28px | 左右 8px / 4px | 14px | 6px |
| xs | 高 20px | 左右 8px / 4px | 10px | 4px |
| sm | 高 24px | 左右 8px / 4px | 12px | 6px |
| lg | 高 32px | 左右 10px / 4px | 16px | 8px |
| icon-md | 28×28px | 居中 | 16px | 8px |

primary 用 primary/primary-foreground；ghost 默认透明、hover 用 hover；outline 用 border，hover 用 border-hover。样板保留可见键盘焦点，不复制全局移除所有焦点描边的副作用。

## 侧栏（提取）

| 部位 | 参数 |
|---|---|
| 宽度 | 默认/最小 264px；最大 max(264px, 父容器 50%)；键盘步长 16px |
| 顶栏/收起 rail 顶栏 | 高 36px；展开图标 16px，品牌图 20px |
| 工作区触发行 | 高 32px；gap 8px；左右 padding 10px/4px；圆角 8px |
| 分组外壳 | padding-top 10px；bottom 0；宽度过渡 200ms ease-out |
| 分组头 | 高 32px；底距 2px；gap 4px；左右 padding 6px/4px；1px 透明边框；圆角 8px |
| 分组计数 | 最小宽 20px；padding 2px 6px；12px medium；行高 1；tag 50% 背景；药丸 |
| 分组内容 | margin-left 16px；左边框 1px；padding-y 1px；padding-left 8px |
| 会话外行 | min-height 28px；列布局允许附加运行信息；padding-left 10px/right 4px；圆角 8px；1px 透明边框 |
| 会话第一行 | 高 28px；gap 8px；标题可缩/截断，元信息不缩 |

交互：hover 与 selected 用不同 token；操作按钮显隐不改变行宽；点击菜单/关闭不触发会话选择；组偏好按稳定 ID 保存。未读/运行/错误优先级和水合规则见 sidebar.md。

样板默认：rail 宽 44px，列表左右 8px，底部 padding 8px，状态点 6px，运行状态用文字/点。原产品运行行可能用 loader，本样板不声称还原所有状态图标；真实实现保持状态优先级，可使用项目现有 Lucide 图标。

## 会话宽度（提取）

以 conversation pane 的容器宽度 C 判断，不以整个窗口：

- 空白草稿内容 max-width 672px。
- 常规 C < 864px：w-full。
- 864px ≤ C < 1280px：width calc(100% - 96px)，max-width 896px。
- C ≥ 1280px：width calc(100% - 384px)，max-width 1152px。
- 状态面板有无采用相同断点，防止正文跳宽。宽屏状态浮层偏移 -168px（42×4）。

样板默认：主标题栏 36px、时间线垂直 padding 24px；左右 padding 32px，在窗口宽 <1024/<768 时变为 16/8px；右侧详情宽 320px、详情内 padding 16px；组件演示采用固定高度 760px。这些组合参数供离线基准使用，不是所有平台原生窗口测量值。

## Markdown（提取）

- 正文：14px、line-height 1.75（24.5px）、letter-spacing .025em；首子元素无顶距，末子元素无底距。
- h1 18px、h2 16px、h3–h6 14px；标题 margin-top/bottom 24/16px；h1–h4 weight 600、h5 500、h6 400。正文 strong 用 500。
- 行内代码：12px mono、6px 圆角、左右 margin 2px、padding 2px 6px、inline-code token 的 50% 背景。
- 代码壳上下 margin 16px、1px border、card 背景；header padding-top 8px/left 12px/right 8px，header 14px；代码字号独立默认 14px。样板代码正文 padding 12px/圆角 8px 为便携默认。
- 无序列表 margin-y 12px、padding-left 20px、outside disc；有序列表 inside decimal、padding-left 0，防止多位编号被裁掉。
- 列表项 padding-left 4px；相邻项距 6px；嵌套列表 margin-y 6px；li > p 为 inline 且无额外 margin。
- 引用 margin-y 16px、左线 2px、padding-left 12px、secondary 文字；内部 p margin 0，相邻段上距 8px。
- 表格 th/td：padding 8px 12px；1px 下边框；min-width 64px、max-width 448px；正常换行和 break-words；th 普通字重、tertiary 文本；末行 td 无底边。
- 链接 base 字号、icon-blue；hover 点状下划线、offset 4px。图片尊重内容宽度，失败显示 alt/错误入口。

样板默认 p margin-y 12px；代码高亮、KaTeX、Mermaid、表格导出/扩展视图需目标 renderer 支持，不由 CSS 实现。表格导出若实现，CSV 单元格以 =/+/−/@ 等公式前缀开头时转文本，并以 UTF-8 BOM 处理中文。

## 思考（提取）

摘要 inline-flex、gap 8px、14px；静态 Brain 图标 16px/tertiary。运行态用标签扫光，不不断旋转脑图标；支持 reduced-motion。折叠时可出现最新摘要，内容过长截断而不推开状态标签。

默认收起；空的流式块不留空行。展开区 top 12px、left 8px、左线 1px、padding-left 14px、max-height 240px、overflow auto、14px tertiary，纯文本 pre-wrap/break-words。嵌套思考不重复加边线。底部锁定判断距离 ≤2px；上滚后不追尾。折叠重内容可在动画后 300ms 卸载，但身份/用户展开偏好不能丢失。

用户主动展开/收起后状态边界不改选择。耗时未知时不用假数值。隐藏完整思考仍保留每轮第一条提示的兼容行为见 tools-thinking.md。

## 工具（提取与宿主契约）

摘要 gap 8px、14px、静态语义图标；kind medium/tertiary，运行标签扫光；详情上距 8px。chevron 16px，hover 显示，展开旋转，200ms ease-out。展开状态按稳定 toolKey 保存；有独立详情 action 的摘要打开 Side Pane，不同时切换内联详情。

工具 renderer 可以声明一次性的 autoOpen，或 running→complete 边沿一次 autoCollapse；不能把所有工具都锁死 forceOpen。思考的“用户操作优先”规则不能不加区分地覆盖原工具 renderer 的专门策略。未知工具默认收起并可查看参数/结果。

连续 Explore/Terminal 默认分组，Changes 默认不分组。组 key 锚定首项。read→路径、search→查询与数量、bash→命令与真实结果、edit/write→文件与真实 diff、subagent→任务摘要、unknown→通用详情。

## 子代理（提取与宿主契约）

父时间线一个工具摘要，不额外加 16px 包装缩进；task title 同时作为右侧 tab title。点击真实记录时只读打开；父/子会话有独立流、滚动、草稿与展开状态。没有持久 session 时展示“本次执行记录”，不能冒充可继续的会话。

并行子任务按稳定 childRunId 归属，链式按 step 展示，失败/取消/未开始清楚区分。模型/thinking/usage 只显示真实已知值，扩展结果契约见 subagents.md。

## 输入框（提取与宿主契约）

壳 flex-column、gap 12px、padding 12px、16px 圆角、1px input-border、input 背景；hover/focus 用对应 token。工具栏 items-end/gap 12px；左侧 controls gap 4px；右侧 gap 6px；发送图标 16px，品牌填充与 inverse 文字。

样板 textarea min-height 48px/max-height 240px；生产编辑器可以是 Lexical 或已有实现，保留 IME composing 时 Enter 不发送、Shift+Enter 换行、按会话草稿、附件、发送/停止状态。收到 prompt 接受响应不代表运行完成。实现失败或拒绝提交时保留草稿。
