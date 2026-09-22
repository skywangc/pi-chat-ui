# 子代理展示与适配

## 能力边界

pi 0.86.1 README 明确无内建统一子代理功能；官方 examples/extensions/subagent 是可选示例，不是安装 pi 就存在的协议。

该示例工具名 subagent，mode 为 single/parallel/chain；独立进程 `pi --mode json -p --no-session`；result/partialResult 的 details.results 包含子任务。

SingleResult 字段为 agent、agentSource、task、exitCode、messages、stderr、usage、model?、stopReason?、errorMessage?、step?。它不提供可直接打开的持久化 childSessionId；processLine 主要在 message_end 等完成消息时收集并 emitUpdate，不能承诺已有逐 token 子 thinking/text 转发。运行中 exitCode 初始也是 0，不可仅凭它显示完成。

先读用户实际扩展/编排；不能自动安装示例，不能认为所有名叫 subagent 的工具 details 都一样。

## 工作台式对话的目标体验

父时间线中 toolCall 与 subagent 配对成一个摘要，不重复两张卡。任务摘要、代理类型、真实状态清楚；与普通工具缩进一致。

有真实详情时点摘要在右侧 Side Pane 打开子对话，保留父会话/滚动/草稿；tab 标题与摘要一致。参考 SubagentSessionSidePane 是 readOnly 视图，复用正文/思考/工具 renderer，滚动/展开独立。

无详情能力时禁用/省略打开子会话，或打开标为本次执行记录的 transcript；不伪造会话、显示空白假详情、复制主消息冒充子输出。

## 路线 A：结果型扩展

适配 details 摘要与 messages；详情是子运行 transcript，不假称可继续聊天的持久会话。按扩展现有粒度刷新，历史使用同 renderer。

宿主分配 invocation/childRun identity。只有 results 数组时先验证派发槽位稳定，再用父 toolCallId + 代际 + 槽位区分同名代理；链式另含 step。顺序不稳定则需扩展提供 ID，不以完成顺序或 agent 名当唯一 ID。

## 路线 B：实时子会话

一比一逐 token 详情需要编排层能力，不仅是 CSS。可约定宿主字段：

`childRunId, rootSessionId, parentSessionId, parentToolCallId, agentLabel, task, status, sequence, messages/events, childSessionId?`

这些非 pi 原生。由子进程/AgentSession 生命周期产生稳定 ID、进度/终态并持久化关系；有真实 session 才绑定 childSessionId。逐 token 需转发子流并复用规范化器。

## 并行、链式、失败

- parallel 每个子项独立状态，一个完成不代表整组完成；乱序结果按 childRunId 回填。
- chain 按步骤显示，未开始可等待；失败后未执行步骤不假装有输出或成功。
- 同名多次运行可区分；父工具失败、子任务失败、取消、进程失联不同。
- 父取消传播以实际扩展为准，收到确认再显示子取消，不凭 UI 猜测。
- 子正文/思考/工具不混进父正文；父只展示定义好的摘要。
- 无 usage/model/duration 不伪造 0；主模型和子代理 usage 不重复统计。
- 关详情 tab 不终止代理；查看不启动/重试/取消运行。

验收：单代理、同名并行、乱序结束、链式等待、子失败而兄弟成功、父取消、无 childSessionId、纯历史 transcript、开关详情、父子各自滚动、子 thinking/工具交错。
