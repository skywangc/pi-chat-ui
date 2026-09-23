---
name: pi-chat-ui
description: 使用自包含的离线规范、主题 CSS 和组件样板，在 React + Tauri + pi 0.86.1 项目中实现紧凑、清晰的工作台式对话 UI/UX，重点覆盖对话 Markdown、模型流式协议、工具调用、思考块及子代理详情（侧边栏概要见包内参考，深入实现用 pi-chat-sidebar 技能）。用于这些界面的实现、迁移和对照验收；不是通用网站设计或 pi 后端功能开发技能。
---

# Pi Chat UI

实现本包定义的工作台式对话布局与交互，同时使用用户项目中的 React、Tauri、pi 0.86.1。用户说的 mk 渲染在本技能中按 Markdown 理解。

## 自包含使用约定

- 本目录是完整参考包。执行本技能不需要外部产品或 pi 的参考仓库，也不要求联网读取上游文件；不要克隆仓库、追踪上游 import 或因缺少参考源码停工。
- 只需读取用户目标项目的 AGENTS.md、依赖和实际平台/事件适配层。技能参考与目标项目独立，不假定某个本机绝对路径。
- 首先阅读 [项目接入](references/integration.md) 和 [组件参数](references/component-recipes.md)。颜色以 [主题 CSS](assets/chat-ui-tokens.css) 为准，布局/状态类可复用 [组件 CSS](assets/chat-ui-components.css)。
- [离线样板](assets/reference-board.html) 可直接用浏览器打开（也附有 [浅色截图](assets/reference-light.png) 和 [深色截图](assets/reference-dark-child.png)），支持浅/深色、侧栏调整、工具/思考展开及子代理详情；不使用 CDN、外部字体或后端。
- 优先级：用户指定画面/要求 → 内置实际组件参数 → 内置设计规范。样板是按源码参数重建的交互参考，不是原应用截图；不要声称已经与原产品像素一致。
- 运行时协议基线为 pi 0.86.1；视觉基线为本包内置规范；[来源记录](references/sources.md) 仅供可选溯源，不是执行步骤。用户要求升级时才查新版本。
- 本技能不自带模型服务、Node/Rust 工具链和完整桌面应用。按目标项目已有条件接入；React/Markdown 库和 pi 是应用自身依赖，不依赖外部 UI 产品仓库。
- 先辨别实际使用 pi RPC、AgentSession SDK 或低层 Agent；差异已写入协议参考。无既有方案时可考虑 Tauri 管理 pi RPC 子进程，但不强制替换用户架构。

## 按任务读取

| 任务 | 必读参考 |
|---|---|
| 主题、尺寸、窗口、整体布局 | [视觉基线](references/visual.md) + [组件参数](references/component-recipes.md)；细查规范时读 [内置设计规范](references/design-system.md) |
| 侧栏概要（深入实现用 pi-chat-sidebar 技能） | [侧栏](references/sidebar.md) |
| 正文、代码、表格、链接、流式滚动 | [Markdown](references/markdown.md) |
| 模型数据、事件 reducer、消息恢复 | [pi 0.86.1 协议](references/pi-protocol.md) |
| 工具调用、分组、思考过程 | [工具与思考](references/tools-thinking.md) + 协议 |
| 子代理卡片、子会话详情、并行/串行任务 | [子代理](references/subagents.md) + 协议 |
| 完成页面或跨层功能 | [验收](references/acceptance.md) 中相关场景 |

按需读取包内参考。所有必需的数值和行为都应从本包取得；未覆盖的新需求按已有 token 和目标项目约定实现，并标明新增设计，不要求用户提供上游仓库。

## 实现约束

1. 沿用目标项目结构，分清 pi 原始数据 → 平台适配 → 会话投影 → React 展示。不引入参考产品的 store、RPC 或 Electron 专用 API。
2. Markdown、thinking、toolCall、toolResult 分类型展示，维持内容顺序，不拼成一个 Markdown 字符串。
3. RPC 文本 delta 追加、结束内容对账覆盖、工具累计 partialResult 替换。SDK 的累计 message 不得再与 delta 叠加。
4. 投影按工作区、会话、运行代际隔离。工具用 toolCallId 关联，消息/块用稳定身份。重复文字不能作为去重依据。
5. 展开、选择、滚动、草稿属于界面状态，不能被 token 更新清空。业务状态来自运行时，不从动画、旧磁盘状态或面板可见性猜测。
6. 只显示 provider 真正返回的思考文本；签名/redacted 内容不作正文。子代理是 pi 扩展/宿主能力，不假设内建 childSessionId。
7. 复用语义 token 和组件几何形状，不改成大卡片、营销页或通用聊天模板。Tauri 拖拽区和原生操作由平台层适配。

## 工作方式与交付

先列本次页面的状态和包内参数依据，再实现 token/展示组件与必要适配。纯视觉阶段可用确定性假数据，但标明 fixture 模式，不把未接入能力显示为真实完成。

数据适配改动回放相关事件；交互改动验证相应页面状态。可用 [RPC 样例](assets/rpc-replay.json) 和 [Markdown 样例](assets/markdown-cases.md)，边界见验收文档。它们是合成输入，不是真实录制或完整测试框架。

完成时说明复现状态、参考版本、验证结果、未覆盖差异。使用本 skill 不代表擅自实现全部页面、安装扩展或替用户启动子代理任务。

可运行 `python3 scripts/validate_bundle.py` 验证技能包内链接、主题变量和离线资源闭包；此命令不连接网络，也不读取上游仓库。
