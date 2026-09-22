# 放入任意目标项目

本目录可以整体复制。所有相对路径以 SKILL.md 所在目录为基准；不用外部产品源码、pi 源码副本或 CDN。运行模型时需要项目自己的 pi 0.86.1 环境，构建桌面程序需要项目自己的 React/Tauri 工具链。

## 实现入口

1. 读目标项目规范和现有组件/平台适配。先选要复刻的范围，不用为了一个侧栏替换项目架构。
2. 将 `assets/chat-ui-tokens.css`、`assets/chat-ui-components.css` 复制到目标项目的样式目录，或按其值融入已有 design token。保留 licenses 中相关通知。它们都是普通 CSS，不需要 Tailwind 构建。
3. 在整个桌面根区域使用 `className="chat-ui-root" data-theme="light"` 或 `dark`。System 由宿主跟踪系统主题后映射到二者。菜单 portal 若挂到根区域外，需要给 portal 容器相同主题或将主题挂到顶层，不让浮层丢失变量。
4. 按 `reference-board.html` 的语义结构和 `component-recipes.md` 复现 React 展示组件。HTML 是示例，不要把其中演示脚本当生产 session store；CSS 可直接复用。
5. pi 数据先经协议适配生成有序块，正文/思考/工具分别路由。宿主能力通过 props/service 注入；HTML 样板不包含真实模型请求。
6. 实现范围内先用样例回放/固定数据比对，再接真实会话。最终依据验收文档验证状态，不以“样板能打开”代替真实业务完成。

## CSS 与 React 组件对应

| CSS | 建议组件职责 |
|---|---|
| chat-ui-app / chat-ui-frame | 窗口内骨架、可调整面板；样板固定高 760px，应用改为可用高度 100% |
| chat-ui-sidebar / chat-ui-task / chat-ui-group | 列表和选中/分组状态；宿主持久化，不依赖演示 localStorage key |
| chat-ui-conversation / chat-ui-content | 会话容器查询与正文宽度，不用 viewport 代替 pane 宽度 |
| chat-ui-markdown | Markdown renderer 的输出容器，不能直接包原始 Markdown 字符串期待 CSS 解析 |
| chat-ui-code / chat-ui-table-wrap | renderer 的 code/table 自定义组件，复制/滚动/高亮由组件实现 |
| chat-ui-summary / chat-ui-reasoning-body | 紧凑可折叠摘要；思考纯文本、工具专用输出 |
| chat-ui-composer | 编辑器壳，不绑定某种编辑器库；粘贴/输入法/草稿由目标项目处理 |
| chat-ui-sidepane | 子代理只读详情，数据范围独立于主会话 |

原版的 class 片段以 Tailwind 4 默认 4px spacing 和 16px rem 解读。本包普通 CSS 已转换主要尺寸；可以用于不采用 Tailwind 的 React 项目。若目标使用 Tailwind，不能直接把普通 CSS 当 `@theme`：按目标版本注册语义颜色/字号，或保留 chat-ui-* 类。

普通 CSS 使用 color-mix/oklab 和容器查询，目标 WebView 需支持这些现代 CSS 能力。若目标环境不支持，按相同语义提供计算后颜色/尺寸 fallback，列为平台适配差异。

## Markdown renderer 绑定

可以用已有 renderer，也可使用 Streamdown（参考基线 2.5.0）；选库与安装以目标项目依赖为准，不自动更新整个项目。

必须具备：流式未闭合容错、完成态静态解析、GFM、可替换 code/table/link/image 组件、单消息错误边界。CJK/数学/Mermaid 只有在任务范围内才加载；显式配置插件时保留默认 GFM，防止表格退化。配置变化不应导致每个 token 都重挂全文。

- pre/code：构建 chat-ui-code 壳、header 和复制按钮，代码文本进入 pre/code，语法高亮由库或现有模块负责。
- table：构建 chat-ui-table-wrap 使宽表内部滚动；复制/导出是额外操作，不由 CSS 自动实现。
- a：按目标工作区解析文件路径/行号，外链交给平台接口，拦截不安全 scheme。
- img：使用附件读取能力，错误显示替代信息，避免 file:// 绕过安全层。
- thinking：直接使用文本节点/React 字符串，保留换行，不使用 Markdown renderer。

## 样板边界

双击 reference-board.html 即可离线预览，也可以由任意本地静态服务打开。里面的输入、任务选中、搜索、调整宽度、开关详情是展示性操作；不会创建真实会话。示例没有流式 Markdown 引擎、虚拟列表、代码高亮、权限系统或代理运行时，这些按规范接入目标项目。

样板中的几何和角色样式有证据等级：已从原组件提取的数值见组件参数；组合布局和未测参数是明确的便携默认值。缺少原应用截图不阻塞使用，验收称“与包内基准一致”，不承诺原版所有页面已逐像素验证。

## 包内截图

- [浅色工作台](../assets/reference-light.png)
- [深色与子代理详情](../assets/reference-dark-child.png)

截图来自本包 reference-board.html，Chromium 1440×1000、默认字号、reduced-motion。它们是随包可查看的重建基准，不是原应用截图。跨系统字体渲染可能不同。
