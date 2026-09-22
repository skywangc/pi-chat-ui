# `@` 文件引用：模糊搜索面板

输入 `@` 后根据输入模糊查询工作区文件并列出，选中后把文件以 markdown 链接形式插进 prompt 文本。pi 没有原生 @ 语法——**产物就是普通文本**，pi 代理收到路径后用自己的 read 工具打开文件。

## 触发

与 `/` 共用触发协议（见 [slash-commands.md](./slash-commands.md)），触发符为 `@`，并额外放宽：

- 汉字紧邻 `@` 也触发（中文不在句中插空格）：`ACTIVE_MENTION_TRIGGER_RE` 的 `\p{Script=Han}` 前缀类；
- 汉字紧邻且 query 呈域名形态（`\S\.\S`）不触发（`联系邮箱@example.com` 是邮箱不是引用）；中文标点后（`看看，@foo.bar`）与空格后正常触发；
- 目录走 `dataTransfer`/插件预注入的 mention（如文件树拖入）不经过触发态，直接插完整 mention（见"数据源"末节）。

## 候选数据源

pi RPC **没有**文件列举命令，候选由客户端自建（这是与 `/` 命令最大的差异）：

- 首选：`git ls-files`（Tauri 侧 shell 或 sidecar 执行），天然尊重 .gitignore，输出稳定；
- 备选：Tauri fs 递归扫描，必须排除 `node_modules`、`.git`、构建产物（`dist`/`target`/`build`）等大目录，否则候选数十万条会拖垮输入；
- 候选结构：`{ name, relativePath, fullPath, type: "file" | "directory" }`；name = basename；
- 索引在会话打开时构建一次，文件树变更（watch）后重建；构建期间面板可用旧索引。

## 模糊打分（scoreFileCandidate）

参考实现：[fuzzy-match.ts](../assets/fuzzy-match.ts)。归一化：trim + toLowerCase。

| 域 | 权重 | 说明 |
| --- | --- | --- |
| name（文件名） | 0 档 | 前缀命中最优（len 差），子串 +100 + 下标，子序列兜底 +200 + 间隙惩罚 |
| relativePath | +25 档 | 目录段子串命中（`comp/cha` 命中 `components/Chat.tsx`） |
| relativePath / fullPath keywords | +300 档 | 跨目录段子的子序列命中 |
| CJK query | 两级制 | 中文 query 只走前缀/连续子串，**禁用子序列兜底**（`浏器` 不得命中 `浏览器操作`——中文用户预期是连续子串） |

排序 tiebreak：score 升序 → 索引（稳定）→ 文件名 locale 比较。目录在空 query 的默认列表中沉底。

### 性能红线（大仓库）

- 展示上限 **1000**（`SUGGESTION_DISPLAY_CAP`）：大到不显残缺，小到打分可承受；
- top-K 用**二分插入**维护（O(n log K)），禁止对每个候选 sort 或 findIndex 线性扫（6.5 万候选 × 1000 实测单键 155ms，整窗冻结）；
- 候选 ≥ 数万时把打分移进 **Web Worker**，并用列式打包字符串（packed）传索引——结构化克隆 37 万条实测 ~471ms 主线程阻塞，列式 ~31ms；过期结果按 seq 丢弃（resolve null），索引重建先清空 items 再异步过滤；
- 主线程永远不做全量候选构建；Worker 创建失败降级为主线程同步过滤（行为不变）。

## 面板与选中

- 面板结构同 `/`：portal、↑↓/Enter/Tab/Esc、signature 判重；
- 分组预览：空 query 时按组展示（文件 / 目录），每组默认预览 3 条（文件优先组 10 条）；有 query 时展示打分后的平铺列表；
- 选中后把 `@query` token 替换为 markdown 链接（见下），光标落在插入内容后的空格之后，面板关闭。

## 产物格式（发送给 pi 的文本）

```ts
// 文件
buildFileMentionMarkdown(relativePath, label) =
  `[${escapeMarkdownLabel(label)}](./${escapeMarkdownDestination(relativePath)})`
// 目录：relativePath 去尾部斜杠后补 /
```

规则：

1. **必须补 `./` 前缀**：流式渲染层的安全策略会把裸路径 `foo/bar.ts` 当自定义协议渲染成 `[blocked]`，`./foo/bar.ts` 是合法相对路径链接，展示与校验都通过；
2. label = 文件名（可带目录消歧），markdown 特殊字符（`\` `[` `]`）反斜杠转义；destination 转义 `\` 和 `>`；
3. 发送时 mention 就是文本里的普通 markdown 链接，pi 收到后按路径读文件；**不要**在客户端预读文件内容塞进 prompt；
4. 追加 mention 到已有文本时，末尾无空白先补一个空格，mention 后补一个空格。

## 与其它 mention 的区分

上游同面板还支持 `$`（技能，`$name` 或 `[$name](./skill-path)`）、`#`（会话引用，`#sess_id`）。本 skill 范围只要求 `@` 文件/目录；如需扩展，保持"触发符 + 打分器 + markdown 产物"三件套协议不变即可。

## 验收要点

见 [acceptance.md](./acceptance.md)。常见翻车：node_modules 没排除导致首开卡死、中文 query 出现子序列误命中、mention 渲染成 `[blocked]`（漏 `./` 前缀）、选中后面板不关或光标位置错误。
