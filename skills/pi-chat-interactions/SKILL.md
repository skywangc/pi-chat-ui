---
name: pi-chat-interactions
description: 使用自包含的离线规范、纯函数参考实现与交互样板，在 React + Tauri + pi 0.86.1 项目中实现对话流的滚动跟随（打开会话贴底、流式跟随、用户滚动立即让位）与输入框交互（贴图/拖放附件进 pi images、/ 命令面板接 pi get_commands、@ 文件模糊引用）。用于这些功能的实现、迁移和对照验收；不覆盖整体布局、Markdown 渲染与子代理展示（见 pi-chat-ui 类技能）。
---

# Pi Chat Interactions

实现本包定义的对话流滚动跟随与输入框交互，配合用户项目中的 React、Tauri 与 pi 0.86.1。

## 自包含使用约定

- 本目录是完整参考包。执行本技能不需要参考产品上游仓库或 pi 源码仓库，不要求联网；不要克隆仓库、追踪上游 import 或因缺少参考源码停工。
- 先读 [项目接入](references/sources.md) 旁的对应功能文档；颜色与几何用 [交互 token CSS](assets/interactions-tokens.css)（`--pci-*`，浅色默认、`[data-theme="dark"]` 覆盖）。
- [离线样板](assets/reference-board.html) 可直接用浏览器打开：左栏演示底部锚定状态机（流式贴底、上滚让位、回到底部按钮），右栏演示 `/` 与 `@` 触发面板（键盘导航、模糊过滤、mention 产物）；不使用 CDN、外部字体或后端。
- 优先级：用户指定画面/要求 → 包内参考实现与参数 → 包内设计规范。样板是按源码参数重建的交互参考，不是原应用截图；不要声称已与原产品像素一致。
- 运行时协议基线为 pi 0.86.1（RPC `prompt/steer/follow_up` 带 `images`、`get_commands`）；视觉与交互基线为本包内置规范。用户要求升级时才查新版本。
- 本技能不自带模型服务、Node/Rust 工具链和完整桌面应用。纯视觉/交互阶段用确定性假数据并标明 fixture 模式，不把未接入能力显示为真实完成。

## 按任务读取

| 任务 | 必读参考 |
| --- | --- |
| 滚动跟随全部场景（打开贴底 / 流式跟随 / 用户滚动让位 / 回到底部 / 会话记忆 / prepend 锚定） | [滚动跟随](references/scroll-following.md) + [scroll-anchor.ts](assets/scroll-anchor.ts)（纯函数可直接拷贝） |
| 贴图、拖放、长文本粘贴、附件上限 | [贴图与附件](references/attachments-paste.md) |
| `/` 命令面板（pi `get_commands`、触发正则、键盘导航、回填） | [斜杠命令](references/slash-commands.md) |
| `@` 文件引用（模糊打分、大仓库性能、markdown 产物） | [文件引用](references/file-mentions.md) + [fuzzy-match.ts](assets/fuzzy-match.ts) |
| 完成功能后对照验收 | [验收清单](references/acceptance.md) 对应分组 |
| 来源与许可 | [来源记录](references/sources.md) |

## 实现约束

1. **滚动权与几何分离**：`following` 只由真实用户滚动输入改变；程序化贴底、测高补偿、折叠产生的 scroll 事件只更新几何账目。禁止把"是否贴底"直接当跟随标志。
2. **贴底前必对账**：所有"内容变化 → 贴底"的 effect（useLayoutEffect / ResizeObserver）在动作前调用 `reconcileFollowingForContentAnchor`，用 commit 时刻实时指标 + 用户意图裁决，防止 scroll 事件晚一帧导致的"上滚被吞"。
3. **贴底必须 instant**（`scrollTop = scrollHeight`），赋值后回读入账；禁用 smooth。
4. **意图捕获在 capture 阶段**：wheel/touch/键盘/滚动条 pointerdown 先于 scroll 事件登记意图；明确向上时立即解除跟随，不等 scroll 事件。
5. **图片不进 prompt 文本**：粘贴/拖入的图片经 base64 进 RPC `prompt/steer/follow_up` 的 `images` 数组（`ImageContent = { type: "image", data, mimeType }`），正文走 `message`；附件上限 8、超限必须提示。
6. **`/` 目录事实源是 pi**：用 RPC `get_commands`（extension/prompt/skill 三源）拉取并在会话切换/扩展热载后刷新；UI 不自行解释命令，发送就是把 `/name args` 原文交给 `prompt`。
7. **`@` 产物是文本**：客户端自建文件索引（排除 node_modules 等），选中后插入 `[label](./relative/path)` markdown 链接（必须 `./` 前缀）；不在客户端预读文件内容；大仓库打分进 Worker、top-K 二分插入、展示上限 1000。
8. **面板协议统一**：`/` 与 `@` 共用触发正则、signature 判重、↑↓/Enter/Tab/Esc 键盘协议与 portal 渲染；IME composing 期间不选中不提交。

## 工作方式与交付

先列本次功能的场景清单与包内参数依据，再实现状态机/管线与必要适配；纯视觉阶段用确定性假数据并标明 fixture 模式。数据适配改动回放对应场景；交互改动逐条过 [验收清单](references/acceptance.md)。

完成时说明复现状态、参考版本（pi 0.86.1）、验证结果、未覆盖差异。使用本 skill 不代表擅自接入真实模型会话、安装扩展或替用户启动子代理任务。

可运行 `python3 scripts/validate_bundle.py` 验证包内链接、离线资源闭包、常量与协议关键词一致性；此命令不连接网络。
