# 来源记录

本包为自包含参考包，以下来源仅用于溯源与许可合规，不是执行步骤。

## 上游参考

- **上游参考产品**：身份、仓库与提交号见 [ATTRIBUTION](../licenses/ATTRIBUTION.txt)（Apache-2.0）。`assets/scroll-anchor.ts` 与 `assets/fuzzy-match.ts` 为其源码中对应纯函数模块（timeline 状态机 / 文件搜索打分）的提炼改写：保留全部语义与常量值，调整命名、注释与组织方式以脱离上游类型依赖。
  - 滚动状态机：`packages/ui/src/v4/timelineScrollAnchor.ts` 与 `ConversationTimeline.tsx` 的接线方式（事件源分类、意图 TTL、layout guard、遮罩、滚动记忆）
  - 模糊打分：`packages/shared/src/workspaceFileSearch.ts`、`packages/ui/src/lib/promptInputTriggers.ts`
  - 粘贴管线：`packages/ui/src/v4/composer/useComposerAttachments.ts`、`packages/ui/src/lib/chatAttachments.ts`
  - 触发面板：`packages/ui/src/SlashCommandPlugin.tsx`、`packages/ui/src/mentions/`
- **pi 0.86.1**（earendil-works/pi，MIT）：协议事实源。`prompt/steer/follow_up` 的 `images` 参数与 `ImageContent` 形状出自 `packages/ai/src/types.ts`；`get_commands` 与 `RpcSlashCommand` 出自 `packages/coding-agent/src/modes/rpc/rpc-types.ts`；命令展开顺序出自 `packages/coding-agent/src/core/agent-session.ts`。本包不复制 pi 源码，仅引用协议事实。

## 开源同类滚动方案（设计交叉验证）

- use-stick-to-bottom（stackblitz-labs，MIT）：rAF 循环 + escape 语义，上游参考产品的直接依赖；
- MUI X Chat scrolling 与 shadcn/ui Message Scroller：规则与本包状态机一致（用户发消息总跟随、离底绝不拉回、live edge 才跟随）。

## 许可

- 本包按 Apache-2.0 分发（见 [LICENSE](../LICENSE)）；
- 上游归属与许可文本见 [licenses/](../licenses/)。复制 `assets/*.ts` 时须保留对应声明。
