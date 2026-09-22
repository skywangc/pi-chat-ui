# pi 0.86.1：数据和运行状态

本页是从 pi 0.86.1 消息类型、RPC 文档和会话实现整理的独立契约；使用时不需要取得这些上游文件。它描述 pi 的事件，不是前端组件状态协议。扩展变化时核对目标项目已安装的类型/实际事件，不猜字段。

## 接入差异

| 接入 | message_update | 结束语义 |
|---|---|---|
| 低层 Agent SDK | 完整累计 message + assistantMessageEvent（含 partial 的类型） | AgentEvent 有 agent_end，没有原生 agent_settled |
| AgentSession SDK | 低层事件，加 retry/compaction/settled 等会话事件 | 以会话层生命周期判定真正空闲 |
| pi --mode rpc | usage + 精简 assistantMessageEvent；无累计 message/partial | agent_end 可能继续；agent_settled 才表示自动续行平息 |

Node SDK 不直接跑进 Tauri WebView；有 Node 宿主时桥接。RPC 由宿主管理子进程、stdin/stdout、进程退出和路由。stdout JSONL 与 stderr 分开。

RPC 以 LF 分记录，可去除记录末尾 CR；字节分块先增量 UTF-8 解码再组装整行，不把 U+2028/U+2029 当分隔，不假设一次 read 等于一条 JSON。

## 消息类型

- user.content：字符串或 text/image 数组。
- assistant.content：有序 text/thinking/toolCall 数组。块为 `{type:'text', text}`、`{type:'thinking', thinking, thinkingSignature?, redacted?}`、`{type:'toolCall', id, name, arguments, thoughtSignature?, namespace?}`。
- toolResult：toolCallId、toolName、text/image content、details?、isError、timestamp。
- assistant 元数据 provider/model/api/usage/stopReason/errorMessage 等不混入正文；usage 是累计快照，不逐 token 求和。
- AgentMessage 可以扩展 custom role；未知类型保留并走明确 fallback，不冒充 assistant。
- signature 是 provider 不透明续接数据；不能渲染、解释成思考，或因 UI 隐藏而从权威历史删除。

## RPC reducer

| 输入 | 动作 |
|---|---|
| message_start | 按 role 建当前消息和稳定本地身份；toolResult 按 toolCallId 关联已有工具 |
| text_start/thinking_start | 在当前 assistant 的 contentIndex 建块，已有块不无故清空 |
| text_delta/thinking_delta | 只向对应块追加 delta，保持块顺序 |
| text_end/thinking_end | 用 content 对账覆盖，不再追加一次全文 |
| toolcall_start | 从 id/toolName 建调用，状态参数生成中 |
| toolcall_delta | 缓存参数字符串；半截 JSON 不作为可执行参数 |
| toolcall_end | 完整 toolCall 覆盖参数，不等于执行结束 |
| message_end | 完整 message 权威，对账而非新增副本，保留 UI 身份 |
| tool_execution_start | toolCallId 转 running，读取 args |
| tool_execution_update | 用累计 partialResult 替换当前输出，不拼接上次全文 |
| tool_execution_end | result/isError 完成同一工具；随后 toolResult 补全历史，不再画第二张卡 |
| turn_end/agent_end | 对账/生命周期，不将其中 messages/toolResults 盲目 append |
| agent_settled | 会话自动续行平息，结合错误/取消决定 UI，不一律成功 |

RPC toolcall_start 有 id/toolName；SDK 同名内层事件需从 partial/message 对应块取值。SDK 推荐快照替换块、事件仅驱动边界；若用 delta reducer，就不再叠加快照。

内层 AssistantMessageEvent 的完整联合还包括 start/done/error；适配器应容忍这些可选边界；已安装宿主未转发某类边界时，不以缺少它为由停止处理有效消息。它们不是正文 delta，不能新增一份回复；error 保留已有块，最终 message_end 对账。AssistantMessage.stopReason 也包含 pending/length/deferred 等值，不把“非 error”全部当完整成功；pending 不表示可停止跟随输出。

直接 RPC bash 的 bash_execution_update.delta 是增量，按命令 id 关联；与模型 bash 工具的累计 partialResult 不同。扩展若有不同结果语义，用专属 adapter 明确处理。

## 生命周期

prompt response.success 只表示接受/排队/处理，不是生成结束。message_end 结束单条消息，turn_end 结束一轮模型调用及工具；agent_end 后仍可能重试、压缩、处理队列。

处理 queue_update、compaction_start/end、auto_retry_start/end、summarization_retry_*、extension_error；临时 agent_end 不闪成完成。abort 后等真实终态/进程退出，不伪造所有工具 success。

extension_ui_request 按 method 分流：select/confirm/input/editor 需相同 id 的 response；notify/setStatus/setWidget 等并非都等回复。是否权限请求由扩展语义决定，不能把任何 confirm 当内建审批。

## 推荐宿主契约（非 pi 原生字段）

事件 envelope：`workspaceId, sessionId, generation, seq, receivedAt, event`。

- generation 为进程/连接代际，seq 在代际内单调递增；桥接重放保留序号才能去重。
- pi 多数事件无全局 eventId/messageId/sessionId，不从不存在字段取 key。宿主在 message_start 分配 messageKey，与持久化 entryId 映射；timestamp 不唯一。
- toolKey = sessionId + generation + toolCallId；blockKey = messageKey + contentIndex；路由不从当前 UI 选中会话推导。
- 重复 seq 可忽略，相同内容的新 seq 不能忽略。无 replay cursor 断连从权威历史重新水合，不假设能补流。
- get_messages/get_entries 用快照替换/按已建身份对账，不接在旧列表后。分支切换投影当前分支，不把整棵树当当前对话。
- 错误/中止保留已有文字和结果；连接状态与业务终态分离。旧 generation 迟到事件不修改新运行。

建议独立 Message、ContentBlock、ToolExecution、SessionActivity、SubagentRun 投影，沿用项目类型，不强制新建 store。raw transcript 为数据依据，collapsed/scroll/selection 不写回模型消息。

## 验证

[合成 RPC 样例](../assets/rpc-replay.json) 验证末尾覆盖、累计替换、结果去重、settled。另测重复 envelope、重连、工具逆序结束、会话混流、redacted、custom role；样例不证明真实 provider/全部扩展兼容。
