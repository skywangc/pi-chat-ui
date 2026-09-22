# 输入框贴图与附件

聊天输入框的剪贴板/拖放/选择三类附件入口共用同一条附件管线。本文覆盖：剪贴板多表示裁决、图片转 pi 协议、限制与提示、Tauri 侧适配。

## 剪贴板粘贴算法（handlePaste）

粘贴事件按优先级裁决（参考上游实现，`clipboardData` 为唯一事实源）：

1. 读三类载荷：`files`（File[]）、`text/plain`、`text/html`；
2. **表格特例**：剪贴板同时含文件与文本、且文本呈表格形态（TSV 多行）时，优先按文本走编辑器，不当作图片附件（Excel/飞书表格复制的多表示 payload）；
3. `files.length > 0` 且非表格特例 → `preventDefault()` + `stopPropagation()`，全部交给附件管线，编辑器不出字；
4. 无文件但 `text/plain` 长文本（≥ 15 × 1024 字符）→ 转为文本附件（平台侧写临时文件或直接内存附件），避免巨量文本冲爆输入框；
5. 其余放行：默认文本插入编辑器。

注意：只在"消费"了载荷时才 `preventDefault`，否则破坏正常文字粘贴；合成事件（IME）路径不受影响。

## 附件数据模型（最小集）

```ts
interface ComposerAttachment {
  id: string;                  // 稳定 id（crypto.randomUUID）
  kind: "image" | "file" | "text";
  filename: string;
  mimeType: string;            // 空时按扩展名推断
  sizeBytes: number;
  data?: string;               // base64（图片直接进 pi 协议）
  objectUrl?: string;          // 本地预览；移除时必须 revokeObjectURL
  origin: "paste" | "pick" | "drag" | "clipboard-text";
}
```

## 限制与提示

- **数量上限 8**：超出时接受前 8 个、多余的丢弃并提示；重复超限用 toast（按 scopeKey 去重），不要只更新输入框底部一行小字（反馈太弱）；
- 单文件大小：pi 协议对 `ImageContent.data` 没有硬上限，但模型上下文有限，建议 guard：图片单张 ≤ 10MB、拒绝 0 字节；超限在附件条上标注错误而不是静默丢弃；
- 每次添加失败要给出行内错误（图标 + 文案），下次添加成功时清除。

## 图片 → pi 协议（本 skill 的关键映射）

pi 0.86.1 的 RPC 三个提交命令都原生带图片：

```text
{ type: "prompt", message: string, images?: ImageContent[] }
{ type: "steer",  message: string, images?: ImageContent[] }
{ type: "follow_up", message: string, images?: ImageContent[] }
```

`ImageContent = { type: "image", data: <base64>, mimeType: "image/png" | "image/jpeg" | ... }`（`@earendil-works/pi-ai` 的 `ai` 类型）。

规则：

- **图片不进 `message` 文本**，不能把 base64 拼进 prompt 字符串；用户正文走 `message`，图片走 `images` 数组，顺序按附件添加顺序；
- 粘贴的截图（`image/png`）→ `File.arrayBuffer()` → base64 → ImageContent；webview 内不需要临时文件；
- 发送后输入框清空附件并 revoke 所有 objectUrl；
- 进行中再次提交：流式期间新消息走 `steer` / `follow_up`（带各自 images），不要拼进当前流；
- 发送失败的附件按原状态留在输入框，不清空。

## 入口三件套

| 入口 | 处理 |
| --- | --- |
| `onPaste` | 见上；`clipboardData.files` 在 Chromium webview 内对截图/复制文件均有效 |
| 文件选择 | `<input type="file" multiple>`；webview 拿不到真实路径没关系——pi 只需要 base64 |
| 拖放 | `dragover` 必须 `preventDefault` 才允许 drop；拖入高亮用 300ms 定时器复位（`dragleave` 在子元素间抖动，直接复位会闪烁）；`dataTransfer.files` 同管线 |

图片附件条（chip）交互：缩略图（objectUrl）+ 文件名 + 大小 + 移除按钮；点击 chip 打开预览 Dialog（左右切换、Esc 关闭）。

## Tauri 侧注意

- webview 的 `clipboardData.files` 覆盖截图与文件复制；系统文件管理器拖入大文件时 `File` 对象可直接读，无需 Tauri fs 权限；
- 需要真实磁盘路径（如 zero-copy 直传路径给 pi 的 read 工具）时用 Tauri 的文件对话框插件选择（返回绝对路径），再决定走 `images`（读出 base64）还是把路径写进 prompt 文本交给 pi 自己读；
- Tauri 窗口的 `fileDropEnabled` 若开启会拦截全局拖放事件（Tauri v2 默认接管），二选一：关闭原生接管走 web 事件，或监听 Tauri 的 `onDragDropEvent` 再喂给同一附件管线。

## 验收要点

见 [acceptance.md](./acceptance.md) 的附件一节。常见翻车：粘贴截图后编辑器同时出了一段乱码文本（忘了 preventDefault 或误读 text/plain）、连贴 9 张图只剩 8 张但没有提示、objectUrl 未 revoke 导致内存增长。
