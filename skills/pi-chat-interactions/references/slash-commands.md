# `/` 命令面板

输入框输入 `/` 展开命令目录，模糊过滤，回车/Tab 选中后把 `/命令 参数` 作为文本交给 pi 执行。命令目录的事实源是 pi 的 RPC `get_commands`，UI 不自己发明命令。

## 数据源：pi 0.86.1 `get_commands`

RPC 返回：

```ts
interface RpcSlashCommand {
  name: string;        // 不含前导 /
  description?: string;
  source: "extension" | "prompt" | "skill";
  sourceInfo: SourceInfo; // 来源文件等元数据
}
```

- `extension`：扩展注册的命令（`registerCommand`）；
- `prompt`：prompt 模板（`~/.pi/prompt-templates/*.md` 与项目 `.pi/prompt-templates/`）；
- `skill`：技能注入的命令。

三条要点：

1. **UI 只展示不解释**：执行就是 `prompt` 提交 `/name args` 文本。pi 在 `agent-session.prompt()` 内部按顺序处理——扩展命令立即执行（不发模型请求）→ 技能展开 → 模板展开。UI 无需也不应复刻这套展开逻辑；
2. 扩展命令在流式进行中也可执行（pi 内部即时处理）；模板/技能在流式期间会被 pi 拒绝或排队，面板对进行中会话可以只展示"可立即执行"子集，最简单做法是全部展示、交给 pi 报错；
3. 会话切换 / 扩展热载后必须**重新拉取** `get_commands`；面板打开时也可带 `get_state` 一起刷新。

## 触发判定

光标前文本（textBeforeCursor）匹配：

```text
ACTIVE_TRIGGER_RE      = /(^|\s)([/@$#¥￥])([^\s/@$#¥￥]*)$/      // 通用：需在行首或空白后
ACTIVE_MENTION_TRIGGER_RE = /(^|[\s\p{Script=Han}\u3000-\u303f\uff00-\uffef])(@)([^\s/@$#¥￥]*)$/u
                                                                    // 仅 @：放宽中文紧邻触发
```

- 触发符 `/` 之外的 `@ $ #`（`¥￥` 归一为 `$`）同属一套面板协议，本文只实现 `/` 与 `@`（见 [file-mentions.md](./file-mentions.md)）；
- **中文输入法特例**：中文里通常不在句中插入空格，`@` 单独放宽允许汉字紧邻触发；但汉字紧邻且 query 呈域名形态（`\S\.\S`，如 `邮箱@example.com`）不触发，避免误伤邮箱；
- 中文顿号 `、` 在编辑器行首时归一为 `/` 触发（输入法按下 `/` 常出顿号），只在行首、非 composing 时生效，且不改写用户实际输入；
- IME composing 期间不选中、不提交（Enter 归输入法）。

query 从触发符后取到光标；随输入实时更新 `signature = trigger:query`，signature 未变不重渲染（防抖更省，但 signature 判重必须保留）。

## 面板行为

- **渲染位置**：portal 到输入区上方的独立挂载层，展开时直接覆盖消息区（不是小气泡）；宽度跟输入区对齐；
- **内容**：空 query 列全量目录；有 query 按模糊分排序（见 [fuzzy-match.ts](../assets/fuzzy-match.ts)，value 0 档 / label +50 / description +250 / keywords +450）；
- 分组展示：按 `source` 分 extension / prompt / skill 三组（或平铺 + 徽标），描述单行省略；
- **键盘**：↑↓ 循环移动、Enter/Tab 选中、Esc 关闭；`selectedIndex` 在 query 变化时重置为 0；空格用于带参命令的补全也可（Tab 语义优先）；
- Esc 只关面板不关其他弹层；面板开着时方向键不得滚动消息区（preventDefault）；
- 关闭后再次输入 `/` 重新打开；同 signature 被手动 Esc 关闭后，同一 signature 不自动重开（dismissed signature 缓存），输入变化后解除。

## 选中回填

选中 `name` 后：

1. 把光标处 `/query` token 替换为 `/name`（注意保留触发符、补一个空格）；
2. 光标置于空格后，面板保持打开并进入参数等待态（query 为空 → 显示全量目录）或按产品取舍直接关闭；上游行为：替换后面板关闭，用户继续输入参数后回车提交；
3. 发送：完整文本（可能 `/cmd args`）原样进 `prompt`，**不要**在客户端预展开命令内容。

## 排除与合并

- 宿主可以传入 `excludedCommandNames`（如与 App 层重复的命令）从目录中剔除；
- App 层自有命令（如窗口操作）可追加在 pi 目录之后展示，pi 已有同名命令时以 pi 为准，避免遮蔽。

## 验收要点

见 [acceptance.md](./acceptance.md)。常见翻车：中文 IME composing 时 Enter 误提交、`/` 出现在句中被误触发（如 URL path）、面板开着时 ↑↓ 滚动了消息区、扩展热载后目录没刷新。
