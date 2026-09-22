# 滚动跟随：底部锚定状态机

对话流滚动的全部难点集中在「用户滚动权」的裁决上。核心状态只有一个布尔值 `following`：

- 用户位于底部 → `following=true`：新内容（新行、流式 delta、测高变化）自动贴底；
- 用户上滚离底 → `following=false`：流式增量不得拉回阅读位置，出现「回到底部」按钮；
- 用户手动滚回底部（或点按钮）→ 恢复跟随。

**`following` 表达用户滚动权，不是瞬时几何快照**：只有真实用户滚动输入可以改变它；程序化贴底、面板折叠、虚拟列表测高补偿产生的 scroll 事件只更新几何账目。把"是否贴底"直接当跟随标志是这类实现最常见的翻车点（程序化贴底 → scroll 事件 → 误判为用户在底部 → 永远无法解除跟随）。

参考实现：[scroll-anchor.ts](../assets/scroll-anchor.ts)（纯函数，无 DOM/React 依赖，可直接拷贝）。

## 常量基线

| 常量 | 值 | 作用 |
| --- | --- | --- |
| `BOTTOM_ANCHOR_EPSILON_PX` | 48 | 离底判定容差，覆盖亚像素滚动与最后一行 padding |
| `UNOBSERVED_SCROLL_EPSILON_PX` | 2 | scrollTop 回退小于该值视为亚像素抖动，不算用户上滚 |
| `USER_SCROLL_INTENT_TTL_MS` | 1200 | 用户滚动意图有效期，超期归零 |
| `LAYOUT_SCROLL_GUARD_MS` | 250 | 布局/测高补偿保护窗，窗内未分类 scroll 不改滚动权 |
| `LOAD_OLDER_TRIGGER_PX` | 64 | 距顶小于该值触发加载更早历史 |
| `LOAD_OLDER_PREFETCH_VIEWPORTS` | 2 | 提前 N 个视口预取补页 |
| `CONTENT_WIDTH_RESIZE_SETTLE_MS` | 120 | 容器宽度 resize 后暂停逐帧补偿的稳定窗 |
| 消息层遮罩 | fade 24px / transparent 96px | 未贴底时输入框上方的淡出遮罩 |

## 事件源分类（scroll 事件处理第一步）

每个 scroll 事件必须先归类 `user | programmatic | layout`：

1. **user**：捕获阶段登记过用户意图（wheel / touch / 键盘 / 滚动条 pointerdown，见下）；
2. **programmatic**：程序化滚动后 rAF 窗口内的 scroll，且 scrollTop 与上次入账差 < 1px；
3. **layout**：意图为 none、非 programmatic、且处于 `LAYOUT_SCROLL_GUARD_MS` 保护窗内；
4. **其余未分类事件按 user 处理**：兼容原生滚动条拖拽与辅助技术（它们可能不产生 wheel/keydown）。

裁决：`source !== "user"` → 保持 `following` 不变；`user` → 按最终落点判定（距底 ≤ 48px ⇔ 跟随）。

### 用户意图捕获（capture 阶段，先于 scroll 事件）

| 输入 | 意图映射 |
| --- | --- |
| `wheel` | deltaY < 0 → `awayFromBottom`；> 0 → `towardBottom` |
| `touch` | 手指下移（clientY 增大）→ `awayFromBottom`；上移 → `towardBottom` |
| 键盘 | ArrowUp/PageUp/Home/Shift+Space → `awayFromBottom`；ArrowDown/PageDown/End/Space → `towardBottom`；目标可编辑（输入框内）→ `none` |
| 滚动条 | pointerdown 命中滚动容器自身（`target === currentTarget`）→ `unknown`，方向由随后 scroll 落点裁决 |

关键规则：**意图为 `awayFromBottom` 时立即解除跟随（不等 scroll 事件）**。因为「运行中 → 终态」的同帧 layout commit（live tail 迁移、折叠历史、测高）会拿过期 `following=true` 把用户拽回底部。

意图带 TTL：`getActiveIntent()` 在 touch/scrollbar 交互进行中返回当前意图（none 视为 unknown），否则按 1200ms 内的最近意图，超期返回 `none`。

## 竞态核心：commit 前对账（最重要的一条）

scroll 事件在滚动发生后的**下一渲染帧**才派发。用户上滚之后、事件派发之前，若恰好落进一个内容变化的 commit（流式 delta、ResizeObserver 测高修正、composer 高度变化），贴底 effect 会拿着**过期的 `following=true`** 把 scrollTop 拽回底部，随后的 scroll 事件再把跟随判回 true——用户的上滚被整体吞掉。

因此所有「内容变化 → 贴底」的 effect（useLayoutEffect / ResizeObserver 回调）在执行贴底动作前必须先对账：

```
```text
  following,                       // 既有跟随态
  metrics: <commit 时刻实时指标>,    // scrollHeight/clientHeight/scrollTop
  lastObservedScrollTop,           // 最近一次已入账 scrollTop
  userScrollIntent: <活跃意图>,
})
// 然后：
anchorActionAfterContentChange(following') === "stickToBottom" ? scrollToBottom() : hold
```

对账规则：

1. 意图明确向上 → 立即解除跟随（同帧 layout commit 也让位）；
2. 无用户输入 → 保持 `following`（虚拟列表测高、折叠导致的 scrollTop 回退不算上滚）；
3. 意图 unknown/toward → 落点在底部则恢复跟随；scrollTop 明显低于 `lastObservedScrollTop - 2px`（未观察上滚）则解除；其余保持。

## 贴底动作本身的规则

- **必须 instant**（`scrollTop = scrollHeight` 赋值），禁用 smooth：smooth 的中间帧会被 scroll 判定误读为「离底」，解除跟随后又判回，产生抖动循环；
- 赋值后**回读** `element.scrollTop` 入账（浏览器会把赋值钳到最大可滚动距离）；
- 内容不足一屏时贴底落点为 0，属正常；
- 程序化贴底前后打 `markProgrammaticScroll()`（rAF 标志位）+ 清除用户意图，防止自己的贴底被误判为用户滚动；
- 贴底后主动 `dispatchEvent(new Event("scroll"))`（微任务）补发只读通知：Chromium 可能合并掉大位移的原生 scroll 通知，造成「滚动条在底部、正文空白」。

## 会话打开 / 切换

- 会话切换 / 首次绑定：`following = initialFollowing()`（= true），随后 `scrollToBottom()` —— **打开历史会话自动定位到最新消息**；
- 有按会话持久化的滚动记忆且记忆态不是"贴底"时：恢复记忆位置（`following=false` + 回读入账），其余场景一律贴底。滚动记忆建议存 `{ scrollTop, scrollHeight, clientHeight, wasPinnedToBottom, updatedAt }`，按 workspace+session 键控、LRU 上限 200 条、恢复时按 `scrollHeight - clientHeight` 比例换算；
- 数据未到达时 DOM scrollTop 被钳为 0：切换会话不能用空时间线覆盖原记忆，保留"待恢复意图"到数据落地；
- 行清空（rewind/编辑）：重置为跟随并收起按钮；
- 恢复期间置 suppress 标志压制 virtualizer 测高补偿一帧，防止恢复位置被推走。

## 内容变化的四个补偿通道（全部要先对账再动作）

| 触发 | 通道 | 规则 |
| --- | --- | --- |
| 新行 / delta 撑高 | 内容 commit 的 useLayoutEffect（依赖 rowCount/totalSize） | 对账 → following 则贴底 |
| 流式块测高 | ResizeObserver 观察 live tail 元素 | 缓存高度；仅在仍有跟随权时贴底，用户已上滚只缓存不夺回 |
| 容器宽度 resize | ResizeObserver 观察内容列 | 置 `contentWidthChanging=true` 暂停逐条补偿与贴底，`settle` 120ms 后若仍跟随只执行一次最终贴底 |
| 顶部前插历史 | prepend commit | `scrollTop += nextTotalSize - prevTotalSize`（仅真前插：首行 rowId 变小）；虚拟列表用稳定 key 的 measurement.start 做绝对恢复：`next.start - savedOffsetTop - currentScrollTop` |

前插注意：

- 前插超过 viewport + overscan 会卸载旧可见行，DOM 不能做跨 commit 锚点，必须用 virtualizer 按 key 维护的测量值；
- 恢复写入同样要 markProgrammaticScroll + 回读入账 + 补发 scroll 通知；
- 待恢复的离底记忆拥有当前 commit 坐标系，前插不得把临时 clamp 值再平移。

## UI 附属件

- **回到底部按钮**：`!following && rowCount > 0` 时显示；点击 → markProgrammaticScroll + `scrollToBottom()`（恢复跟随由落点判定自然完成）；
- **输入框上方遮罩**：未贴底时对消息层应用 mask（`linear-gradient(to bottom, black 0→(viewport-96-24)px, transparent (viewport-96)px→100%)`，按 scrollTop 对齐），避免最后一条消息从输入区留白透出；贴底时移除 mask（消息已在文档流末尾，保留 mask 会无意义淡出末条消息）。遮罩只裁消息层，不得裁掉 sticky composer 与按钮；
- 键盘快捷键（如 `Cmd+↓` 贴底）走同一 `scrollToBottom()`。

## 直接可用的库替代

- **use-stick-to-bottom**（stackblitz-labs，MIT，上游参考产品的依赖）：rAF 循环 + escape 语义（用户上滚 escape → 手动滚回或调 `scrollToBottom()` 恢复），弹簧平滑滚动，提供 `isAtBottom` / `scrollToBottom` / `stopScroll`。适合不想自研状态机的项目；注意它的 smooth 动画与本规范「贴底必须 instant」的取舍：流式高频追加时用库的默认行为即可，但其 escape 判定同样基于"用户滚动后落点是否在底部"，与本状态机语义一致；
- **MUI X Chat / shadcn Message Scroller** 的规则与本规范一致：用户发消息总是跟随；助手新内容仅在"位于 live edge"时跟随；一旦离底绝不拉回。

选择建议：要一比一上游参考行为（含 scrollbar pointerdown、layout guard、意图 TTL）→ 用本参考实现；要最小实现 → 上述状态机的 `resolveFollowingAfterScroll + anchorActionAfterContentChange + reconcile` 三件套 + 回到底部按钮即可，其余按需补。
