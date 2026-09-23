/**
 * 侧边栏行状态与几何（纯函数参考实现，无 DOM/React 依赖，可直接拷入目标项目）。
 *
 * 核心原则：
 * 1. 实时活动（phase/hasBackgroundWork/pendingInteractions）与会话成员元数据
 *    （标题/未读/分组/置顶）是两条数据线，行状态只在两者合并后的视图模型上判定；
 * 2. 「转圈」必须由当前运行时实时证明——持久化里的 running 只说明落盘时未收到终态，
 *    绝不能让历史会话在新一轮 app 里一直转圈；
 * 3. 未读是成员字段（数字时间戳），直接读当前行数据，不与其它权威混用。
 *
 * 来源：按上游 Apache-2.0 参考实现提炼（见 licenses/ATTRIBUTION.txt）。
 */

/** 会话实时 phase（由事件流 / sessions 索引推送，UI 只读不推导）。 */
export type SidebarSessionPhase =
  | "prewarming"
  | "running"
  | "completedSuccess"
  | "completedError"
  | "error"
  | string;

/** 持久化里的历史状态（落盘快照，不能当实时用）。 */
export type PersistedTaskStatus = "idle" | "creating" | "notReady" | "restoring" | "ready" | "streaming" | "completed" | "failed" | string;

export interface SidebarRowActivity {
  phase?: SidebarSessionPhase;
  lastActivityAt?: number;
  hasBackgroundWork?: boolean;
  pendingInteractions?: {
    permissionCount: number;
    userInputCount: number;
  };
}

export interface SidebarRowMeta {
  /** 未读标记：数字 = 标记时刻的时间戳；缺失 = 已读。 */
  unreadAt?: number;
  /** 落盘状态，仅作 phase 缺席时的 error 回退。 */
  status?: PersistedTaskStatus;
}

/**
 * 行首指示器判定（优先级从高到低）：
 * 1. error：实时 phase==="error"；仅当 activity 尚未水合（搜索结果/索引未到）才回退落盘 error；
 * 2. unread：unreadAt 为数字即未读（蓝点）；
 * 3. loading：实时 phase 为 prewarming/running（转圈）；
 * 4. none。
 * 关键：落盘 status=running 不产生 loading。
 */
export function deriveSidebarIndicator(
  activity: SidebarRowActivity | null | undefined,
  meta: SidebarRowMeta,
): "error" | "unread" | "loading" | "none" {
  if (activity?.phase === "error") return "error";
  if (!activity && meta.status === "error") return "error";
  if (typeof meta.unreadAt === "number") return "unread";
  if (activity?.phase === "prewarming" || activity?.phase === "running") return "loading";
  return "none";
}

/** 转圈判定：只认实时 phase。 */
export function isSidebarRowRunning(activity: SidebarRowActivity | null | undefined): boolean {
  return activity?.phase === "prewarming" || activity?.phase === "running";
}

/**
 * 排序用「运行层」成员判定：回合在跑 **或** 有后台工作（后台 bash / 分离子代理 / 工作流 run）。
 * 动态 run 在父回合收口后 phase 已回终态，但 lastActivityAt 仍被 run 进度推进——
 * 排序层若只看 phase，两个各跑 run 的会话会在非运行层里互相换位。转圈图标仍只认 phase。
 */
export function isSidebarRowActiveForSorting(activity: SidebarRowActivity | null | undefined): boolean {
  return isSidebarRowRunning(activity) || activity?.hasBackgroundWork === true;
}

/** 右侧注意胶囊：总数 > 0 才显示；userInput 优先于 permission。 */
export function deriveSidebarAttention(
  activity: SidebarRowActivity | null | undefined,
): { kind: "permission" | "userInput"; count: number } | null {
  const summary = activity?.pendingInteractions;
  if (!summary) return null;
  const count = summary.permissionCount + summary.userInputCount;
  if (count === 0) return null;
  return { kind: summary.userInputCount > 0 ? "userInput" : "permission", count };
}

/** 相对时间：<1min 刚刚；<60min N 分钟前；<24h N 小时前；其余 N 天前。 */
export function formatSidebarRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

// ── 宽度与缩放 ──

export const SIDEBAR_DEFAULT_WIDTH_PX = 264;
export const SIDEBAR_MIN_WIDTH_PX = 264;
/** 侧栏最大占容器宽度比例。 */
export const SIDEBAR_MAX_WIDTH_RATIO = 0.5;
/** 键盘缩放步长（px）。 */
export const SIDEBAR_RESIZE_KEYBOARD_STEP_PX = 16;
/** 会话区宽度小于该值时自动收起侧栏。 */
export const CONVERSATION_AUTO_COLLAPSE_SIDEBAR_WIDTH_PX = 360;
/** 宽度变化后判定「拖拽结束」的静止窗口。 */
export const CONVERSATION_AUTO_COLLAPSE_RESIZE_IDLE_MS = 300;

/** 宽度钳制：[min, max(容器×0.5, min)]，四舍五入。容器未知时不设上限。 */
export function clampSidebarWidth(widthPx: number, containerWidthPx?: number): number {
  const maxWidthPx =
    containerWidthPx && containerWidthPx > 0
      ? Math.max(SIDEBAR_MIN_WIDTH_PX, containerWidthPx * SIDEBAR_MAX_WIDTH_RATIO)
      : Number.POSITIVE_INFINITY;
  return Math.round(Math.max(SIDEBAR_MIN_WIDTH_PX, Math.min(widthPx, maxWidthPx)));
}

export type SidebarResizeKeyIntent =
  | { kind: "step"; deltaPx: number }
  | { kind: "min" }
  | { kind: "max" }
  | { kind: "none" };

/** 键盘缩放意图：←−16 / +→+16 / Home=min / End=max；其余 none。 */
export function sidebarResizeKeyIntent(key: string): SidebarResizeKeyIntent {
  if (key === "ArrowLeft") return { kind: "step", deltaPx: -SIDEBAR_RESIZE_KEYBOARD_STEP_PX };
  if (key === "ArrowRight") return { kind: "step", deltaPx: SIDEBAR_RESIZE_KEYBOARD_STEP_PX };
  if (key === "Home") return { kind: "min" };
  if (key === "End") return { kind: "max" };
  return { kind: "none" };
}
