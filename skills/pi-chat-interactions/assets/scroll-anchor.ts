/**
 * 底部锚定状态机（纯函数参考实现，无 DOM/React 依赖，可直接拷入目标项目）。
 *
 * 语义（following）：
 * - 用户位于底部 → following=true，新内容（新行 / 流式 delta / 测高变化）自动贴底；
 * - 用户上滚离底 → following=false，流式增量不得拉回阅读位置，出现「回到底部」按钮；
 * - 用户手动滚回底部（或点按钮）→ 恢复跟随。
 *
 * following 表达用户滚动权，不是瞬时几何快照：只有真实用户滚动输入可以改变它；
 * 程序化贴底、折叠和虚拟列表测高补偿产生的 scroll 事件只更新几何账目。
 *
 * 来源：按上游 Apache-2.0 参考实现提炼（见 licenses/ATTRIBUTION.txt）。
 */

/** 离底判定容差：小于该距离视为「在底部」。取值覆盖亚像素滚动与最后一行 padding。 */
export const BOTTOM_ANCHOR_EPSILON_PX = 48;

/** 未观察滚动的判定容差：小于该值的 scrollTop 回退视为亚像素抖动，不算用户上滚。 */
export const UNOBSERVED_SCROLL_EPSILON_PX = 2;

/** 用户滚动意图的有效期：超期后 intent 归零，避免陈旧的向上意图吞掉合法贴底。 */
export const USER_SCROLL_INTENT_TTL_MS = 1200;

/** 布局/测高补偿的保护窗：窗内的未分类 scroll 事件不得改变用户滚动权。 */
export const LAYOUT_SCROLL_GUARD_MS = 250;

/** 顶部补页触发阈值：距顶小于该距离视为「到顶」。 */
export const LOAD_OLDER_TRIGGER_PX = 64;

/** 提前 N 个视口补页，网络与渲染应在用户抵达窗口边界前完成。 */
export const LOAD_OLDER_PREFETCH_VIEWPORTS = 2;

/** 容器宽度 resize 后，暂停逐帧补偿并等待稳定的时间窗。 */
export const CONTENT_WIDTH_RESIZE_SETTLE_MS = 120;

export interface ScrollMetrics {
 /** 滚动容器 scrollTop。 */
 scrollTop: number;
 /** 滚动容器可视高度（clientHeight）。 */
 viewportHeight: number;
 /** 内容总高度（scrollHeight）。 */
 contentHeight: number;
}

/** 距底部的剩余可滚动距离（内容不足一屏时为 0）。 */
export function distanceToBottom(metrics: ScrollMetrics): number {
 return Math.max(
  0,
  metrics.contentHeight - metrics.viewportHeight - metrics.scrollTop,
 );
}

export function isAtBottom(
 metrics: ScrollMetrics,
 epsilonPx: number = BOTTOM_ANCHOR_EPSILON_PX,
): boolean {
 return distanceToBottom(metrics) <= epsilonPx;
}

export type ScrollEventSource = "user" | "programmatic" | "layout";

/**
 * scroll 事件后的滚动权裁决。布局/程序化 scroll 不得改变用户意图；
 * 只有用户输入才按最终落点决定是否跟随（落点在底部 ⇔ 跟随）。
 */
export function resolveFollowingAfterScroll(input: {
 following: boolean;
 metrics: ScrollMetrics;
 source: ScrollEventSource;
 epsilonPx?: number;
}): boolean {
 if (input.source !== "user") return input.following;
 return isAtBottom(input.metrics, input.epsilonPx);
}

/**
 * 内容变化（新行追加 / 流式 delta 撑高 / 动态测高修正）后的动作：
 * 跟随中 → 贴底；已解除 → 保持阅读位置（绝不拉回）。
 */
export function anchorActionAfterContentChange(
 following: boolean,
 contentWidthChanging = false,
): "stickToBottom" | "hold" {
 return following && !contentWidthChanging ? "stickToBottom" : "hold";
}

export type UserScrollIntent =
 | "none"
 | "awayFromBottom"
 | "towardBottom"
 | "unknown";

/** wheel 的 deltaY 与 scrollTop 同向：负值阅读更早内容，正值靠近底部。 */
export function wheelScrollIntent(deltaY: number): UserScrollIntent {
 if (deltaY < 0) return "awayFromBottom";
 if (deltaY > 0) return "towardBottom";
 return "none";
}

/** touch 手指位移与 scrollTop 反向：手指下移表示阅读更早内容。 */
export function touchScrollIntent(
 previousClientY: number,
 nextClientY: number,
): UserScrollIntent {
 if (nextClientY > previousClientY) return "awayFromBottom";
 if (nextClientY < previousClientY) return "towardBottom";
 return "none";
}

/** 键盘滚动意图；输入控件内的光标按键不属于消息区滚动。 */
export function keyboardScrollIntent(input: {
 key: string;
 shiftKey: boolean;
 editableTarget: boolean;
}): UserScrollIntent {
 if (input.editableTarget) return "none";
 if (
  input.key === "ArrowUp" ||
  input.key === "PageUp" ||
  input.key === "Home"
 ) {
  return "awayFromBottom";
 }
 if (
  input.key === "ArrowDown" ||
  input.key === "PageDown" ||
  input.key === "End"
 ) {
  return "towardBottom";
 }
 if (input.key === " ") {
  return input.shiftKey ? "awayFromBottom" : "towardBottom";
 }
 return "none";
}

/**
 * 内容变化 commit 贴底前，对账用户滚动意图。
 *
 * 跟随态由 scroll 事件驱动，但 scroll 事件在滚动发生后的下一渲染帧才派发：
 * 用户上滚之后、事件派发之前，若恰好落进一个内容变化的 React commit
 * （流式 delta、ResizeObserver 测高修正），贴底 effect 会拿着过期的 following=true
 * 把 scrollTop 拽回底部，随后的 scroll 事件再把跟随判回 true——用户的上滚被整体吞掉。
 *
 * 对账规则（在贴底动作之前执行，输入为 commit 时刻的实时指标）：
 * 1. 明确向上滚动 → 立即解除跟随，同帧 terminal/layout commit 也必须让位；
 * 2. 没有用户输入 → 原样保持 following，virtualizer/折叠导致的 scrollTop 回退不算上滚；
 * 3. 方向未知或向下的用户输入 → 落点在底则恢复跟随，
 *    明显低于上次入账 scrollTop（未观察上滚）则解除，其余保持。
 */
export function reconcileFollowingForContentAnchor(input: {
 following: boolean;
 metrics: ScrollMetrics;
 /** 最近一次「已账目」的 scrollTop（scroll 事件读取值或程序化写入后的回读值）。 */
 lastObservedScrollTop: number;
 userScrollIntent?: UserScrollIntent;
 bottomEpsilonPx?: number;
 scrollEpsilonPx?: number;
}): boolean {
 const userScrollIntent = input.userScrollIntent ?? "unknown";
 if (userScrollIntent === "awayFromBottom") return false;
 if (userScrollIntent === "none") return input.following;
 if (isAtBottom(input.metrics, input.bottomEpsilonPx)) return true;
 const unobservedUpscroll =
  input.metrics.scrollTop <
  input.lastObservedScrollTop -
   (input.scrollEpsilonPx ?? UNOBSERVED_SCROLL_EPSILON_PX);
 if (unobservedUpscroll) return false;
 return input.following;
}

/** 「回到底部」按钮可见性：仅在解除跟随且确实存在内容时展示。 */
export function shouldShowBackToBottom(
 following: boolean,
 rowCount: number,
): boolean {
 return !following && rowCount > 0;
}

/** 会话切换 / 首次绑定：重置为跟随（打开会话定位到最新消息）。 */
export function initialFollowing(): boolean {
 return true;
}

// ── loadOlder：prepend 滚动锚定（虚拟滚动前插的经典坑）──
//
// 语义：向窗口顶部前插历史行时，用户正在读的行（锚点）在视口中的位置不得跳动。
// 虚拟列表下前插只改总高度，锚定恢复 = scrollTop 平移「前插内容撑高的那段」：
//   scrollTop' = scrollTop + (nextTotalSize - prevTotalSize)
// 前提：既有 render unit key 稳定，且同一帧内无其它测量修正。

export interface PrependAnchorInput {
 /** 上一 commit 的窗口首行 rowId（null = 尚无行）。 */
 prevFirstRowId: number | null;
 /** 本 commit 的窗口首行 rowId（null = 行被清空）。 */
 nextFirstRowId: number | null;
 /** 上一 commit 的虚拟列表总高度。 */
 prevTotalSize: number;
 /** 本 commit 的虚拟列表总高度。 */
 nextTotalSize: number;
}

/**
 * 前插后的 scrollTop 平移量。仅当「首行 rowId 变小」（真前插）时返回正平移；
 * 追加/替换/清空/首帧一律 null（不动滚动位置，交给底部锚定逻辑）。
 */
export function prependScrollAdjustment(
 input: PrependAnchorInput,
): number | null {
 if (input.prevFirstRowId === null || input.nextFirstRowId === null)
  return null;
 if (input.nextFirstRowId >= input.prevFirstRowId) return null;
 const delta = input.nextTotalSize - input.prevTotalSize;
 return delta > 0 ? delta : null;
}

/** scroll 事件是否应触发 loadOlder（到顶 + 可拉 + 非在途）。 */
export function shouldTriggerLoadOlder(input: {
 scrollTop: number;
 canLoadOlder: boolean;
 loadingOlder: boolean;
 triggerPx?: number;
}): boolean {
 return (
  input.canLoadOlder &&
  !input.loadingOlder &&
  input.scrollTop <= (input.triggerPx ?? LOAD_OLDER_TRIGGER_PX)
 );
}

/** 预取触发距离：至少 LOAD_OLDER_TRIGGER_PX，随视口高度放大到 N 个视口。 */
export function historyPrefetchTriggerPx(viewportHeight: number): number {
 if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
  return LOAD_OLDER_TRIGGER_PX;
 }
 return Math.max(
  LOAD_OLDER_TRIGGER_PX,
  viewportHeight * LOAD_OLDER_PREFETCH_VIEWPORTS,
 );
}
