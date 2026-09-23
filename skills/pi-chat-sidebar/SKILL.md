---
name: pi-chat-sidebar
description: 使用自包含的离线规范、纯函数参考实现与交互样板，在 React + Tauri + pi 0.86.1 项目中实现工作台式对话应用的会话侧边栏：双索引行状态（运行/未读/出错/等待输入）、运行层置顶排序、分组与整理偏好、行标题走马灯、宽度缩放与折叠、右键菜单与草稿行，以及 pi 会话数据（SessionInfo/RPC）的组装映射。用于侧边栏的实现、迁移和对照验收；不覆盖对话区布局、滚动跟随与输入框交互（见 pi-chat-ui / pi-chat-interactions）。
---

# Pi Chat Sidebar

实现本包定义的会话侧边栏，配合用户项目中的 React、Tauri 与 pi 0.86.1。

## 自包含使用约定

- 本目录是完整参考包。执行本技能不需要参考产品上游仓库或 pi 源码仓库，不要求联网；不要克隆仓库、追踪上游 import 或因缺少参考源码停工。
- 先读 [会话列表状态](references/session-list.md)（架构根基），再按任务读对应文档；颜色与几何用 [侧栏 token CSS](assets/sidebar-tokens.css)（`--pcb-*`，浅色默认、`[data-theme="dark"]` 覆盖）。
- [离线样板](assets/reference-board.html) 可直接用浏览器打开：分组会话列表（运行中/未读/出错/等待输入行）、草稿行、行 hover 换动作、长标题走马灯、右键菜单、分隔条拖拽与键盘缩放、折叠窄轨；不使用 CDN、外部字体或后端。
- 优先级：用户指定画面/要求 → 包内参考实现与参数 → 包内设计规范。样板是按源码参数重建的交互参考，不是原应用截图；不要声称已与原产品像素一致。
- 运行时协议基线为 pi 0.86.1（`SessionInfo`、`get_state/get_tree/new_session/switch_session/set_session_name`）；视觉与交互基线为本包内置规范。用户要求升级时才查新版本。
- 本技能不自带模型服务、Node/Rust 工具链和完整桌面应用。纯视觉/交互阶段用确定性假数据并标明 fixture 模式，不把未接入能力显示为真实完成。
- 与 pi-chat-ui（布局/Markdown/工具/子代理）和 pi-chat-interactions（滚动跟随/输入框）互补；同项目并用时侧栏不重复实现它们的能力。

## 按任务读取

| 任务 | 必读参考 |
| --- | --- |
| 行状态、双索引架构、运行层排序、注意胶囊 | [会话列表状态](references/session-list.md) + [sidebar-model.ts](assets/sidebar-model.ts)（纯函数可直接拷贝） |
| 宽度、拖拽/键盘缩放、自动收起、折叠窄轨 | [布局与缩放](references/layout-resize.md) |
| organizeBy/sortBy 偏好、分组模型、吸顶组头、拖拽、虚拟化 | [分组与整理](references/groups-organize.md) |
| 标题走马灯、meta 层级、hover 行为、右键菜单、草稿行 | [行 UI](references/row-ui.md) |
| pi 会话数据从哪来、RPC/SDK 映射、组装路线 | [pi 会话数据映射](references/pi-sessions.md) |
| 完成功能后对照验收 | [验收清单](references/acceptance.md) 对应分组 |
| 来源与许可 | [来源记录](references/sources.md) |

## 实现约束

1. **双索引分离**：实时活动（phase/hasBackgroundWork/pendingInteractions）是 UI-only sidecar，绝不写回持久层；成员变更（rename/pin/archive/unread）只覆盖成员字段，不得整行替换。
2. **转圈必须实时证明**：落盘 running 只说明退出时未收终态，新进 app 后 loading 只能由当前运行时 phase（prewarming/running）驱动；落盘 error 仅在活动线缺席时兜底。
3. **指示器优先级**：error → unread → loading → none，用 [sidebar-model.ts](assets/sidebar-model.ts) 的判定链，不各自发明。
4. **运行层置顶**：排序层判定 = 回合在跑 **或** 有后台工作；转圈图标只认 phase。行 key 用稳定会话 id，禁止数组下标。
5. **等待胶囊是行动入口**：hover 换装时常规 meta 隐藏、等待胶囊不隐藏；等待胶囊存在时不并排显示相对时间。
6. **标题溢出走马灯**：右侧 1.5rem 渐隐；hover 1s 后 40px/s 滚动、单程 ≥6s、循环停 2s；溢出判定用单份标题排版宽；剥掉原生 title。
7. **宽度体系**：264px 默认=最小，容器 50% 上限，键盘步长 16px（←→/Home/End），持久化值读取时必须过钳制；拖拽中禁用过渡动画；会话区 <360px 静止 300ms 自动收起。
8. **视图偏好持久化**：organizeBy/sortBy/折叠组集合等用户设置必须持久化并逐字段校验回退；新行进折叠组时自动展开。
9. **分组是用户手整理的结构**：拖拽与右键菜单共用同一组视图操作原语；拖拽 overlay 副本纯展示、不挂副作用。
10. **pi 数据组装**：成员线来自 SDK `listSessions`（或 Tauri fs 扫描），活动线来自 RPC 事件流 + `get_state` 对齐；app 启动时所有已知会话置「无活动」；未读/分组/置顶/归档为纯客户端成员线。

## 工作方式与交付

先列本次功能的场景清单与包内参数依据，再实现视图模型/组件与必要的数据组装；纯视觉阶段用确定性假数据并标明 fixture 模式。交互改动逐条过 [验收清单](references/acceptance.md)。

完成时说明复现状态、参考版本（pi 0.86.1）、验证结果、未覆盖差异。使用本 skill 不代表擅自接入真实模型会话、删除用户会话文件或替用户改动其分组整理。

可运行 `python3 scripts/validate_bundle.py` 验证包内链接、离线资源闭包、常量与协议关键词一致性；此命令不连接网络。
