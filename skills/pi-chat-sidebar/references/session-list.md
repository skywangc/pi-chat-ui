# 会话列表：行状态与双索引架构

侧边栏每一行同时呈现「成员信息」（标题、未读、分组、置顶、更新时间）与「实时活动」（运行中、等待确认、出错）。上游的关键架构决策是**把两条数据线分开**，行状态只在合并后的视图模型上判定。这是所有状态显示正确性的根基。

## 双索引架构

| 数据线 | 内容 | 特点 |
| --- | --- | --- |
| 成员索引（membership） | 标题、未读（unreadAt）、分组、置顶、归档、createdAt/updatedAt | 持久化；rename/pin/archive/unread 等操作只改这条线 |
| 活动索引（activity sidecar） | `phase`、`lastActivityAt`、`hasBackgroundWork`、`pendingInteractions` | 实时推送；**UI-only sidecar**，不进持久化 schema |

合并规则（`mergeTaskListMembershipFields` 语义）：

- 活动行挂在行的内部字段上（如 `__sessionActivity`），**绝不写回持久层**；
- 成员变更响应（rename/pin/archive/unread）**只覆盖成员字段**，不得整行替换——否则会丢掉实时 phase、错误跳序（成员响应自带 updatedAt 会把行顶到「刚更新」）、丢掉未读乐观状态；
- 未读乐观更新以 UI 内存为准：持久层回放只在 store 缺行时回退 `unreadAt`，避免旧列表覆盖「刚点开已读」。

## 状态机

运行时状态（实时）：

```text
idle → creating → notReady → restoring → ready → streaming → completed | failed | error
```

- `isRunning = creating | restoring | streaming`（运行中的三种形态：冷启动、恢复快照、流式回合）；
- 终态/非运行态切换时**必须清掉活动期的路由字段**（activeInputId / activeTurnKind / 持有者 clientId）：不清理的话，移动端靠快照补齐时会把已结束任务误判为仍在 loading，compact 完成后 app 层也会把发送误判为「压缩中」而吞掉。

## 行首指示器（leading indicator）

优先级链（见 [sidebar-model.ts](../assets/sidebar-model.ts) `deriveSidebarIndicator`）：

1. **error**（红点）：实时 `phase === "error"`；**仅当** activity sidecar 尚未水合（搜索结果、索引未到）才回退落盘 `status === "error"`；
2. **unread**（蓝点）：`unreadAt` 为数字。直接读当前行成员字段，不回退旧的全局 map——两个未读权威会互相打架；
3. **loading**（转圈）：实时 `phase === "prewarming" | "running"`；
4. **none**。

> **本技能最重要的一条**：落盘 `status=running` 只说明上次退出时还没收到终态。新进 app 后 loading 必须由当前运行时实时证明，否则历史列表会把上次未完成的会话永远转圈。同理，实时 phase 恢复权威后，落盘 error 只在 sidecar 缺席时兜底。

视觉：loading = `size-3.5` 旋转图标（spinner）；error = `size-1.5` 红点；unread = `size-1.5` 蓝点（`bg-sky-500 dark:bg-sky-400`，与普通任务列表共用天蓝，避免品牌色漂移）；均放在标题左侧同一槽位。

## 右侧注意胶囊（attention / interaction）

优先级从高到低，**互斥显示**：

1. **pendingInteraction 交互胶囊**（最高优先级）：会话正等待用户操作。两类：`permission`（工具授权）与 `userInput`（提问）。userInput 带倒计时进度条时可暂停倒计时（snooze）；同类事件相邻两帧到达（如授权请求与自动解决事件）需要按 interactionId 去重；
2. **attention 徽章**：`pendingInteractions` 汇总（permissionCount + userInputCount），`userInputCount > 0` 时显示「需要输入」否则「待授权」；count > 1 追加数量（如「待授权 ×3」）。样式：`h-5` 圆角徽章、成功色底（`bg-success/14 dark:bg-success/18`）；
3. **常规 meta**：指示器 + 定时任务/闲时图标 + 相对时间。

注意胶囊存在时相对时间**不再并排显示**——两者挤占标题宽度；且 hover 隐藏常规 meta 时**交互胶囊不隐藏**（它是行动入口，不是元信息）。

## 相对时间

`formatSidebarRelativeTime`：`<1min` 刚刚；`<60min` N 分钟前；`<24h` N 小时前；其余 N 天前。时间基准取行的 `lastActivityAt`（活动线），不是成员 updatedAt。**定时刷新**：挂一个 30s/60s 的 tick 让所有行的时间标签同步更新，不要只依赖渲染时机。

## 排序：运行层置顶

- 「运行层」= 回合在跑（prewarming/running）**或** `hasBackgroundWork === true`（后台 bash、分离子代理、工作流 run）；
- 转圈图标只认 phase；**排序层**必须把后台工作也算进去——父回合收口后 phase 已回终态，但每条 run 进度事件仍在推进 lastActivityAt，只看 phase 会让两个各跑 run 的会话在非运行层里随进度互相换位；
- 运行层内部按 lastActivityAt 降序；非运行层按 sortBy（updated/created）；
- 实时 lastActivityAt 只属于活动线：成员 mutation 不得改写排序键。

## 等待确认 ≠ 运行中

等待授权/输入的会话在 phase 上可能仍是 running（回合被挂起）。行上用 attention 徽章表达「轮到用户了」，转圈可以继续（回合未结束）也可以按产品取舍暂停；两者语义独立，不要用一个状态位同时驱动两个 UI。
