# Pi Chat Skills

面向 **React + Tauri + pi 0.86.1** 工作台式对话应用的自包含技能集合。每个技能是独立可安装的参考包，互不依赖、可单装或同装。

| 技能 | 覆盖范围 |
| --- | --- |
| [pi-chat-ui](skills/pi-chat-ui/) | 整体布局与视觉基线：流式 Markdown、消息数据适配、工具调用、思考过程、子代理详情 |
| [pi-chat-interactions](skills/pi-chat-interactions/) | 交互层：滚动跟随（贴底状态机）、贴图/拖放附件（pi `images`）、`/` 命令面板（pi `get_commands`）、`@` 文件模糊引用 |
| [pi-chat-sidebar](skills/pi-chat-sidebar/) | 会话侧边栏：双索引行状态（运行/未读/出错/等待输入）、运行层置顶、分组与整理偏好、标题走马灯、宽度缩放与折叠、右键菜单、pi 会话数据组装 |

三个技能同项目并用时，视觉 token 以 pi-chat-ui 为准，交互 token（`--pci-*`）与侧栏 token（`--pcb-*`）与其同源不冲突。

## 安装（任选技能）

推荐 [skills CLI](https://skills.sh)（自动识别 Pi、Claude Code 等已安装的 agent 并建立链接）：

```bash
# 项目级安装单个技能（在目标项目根目录执行）
npx skills add skywangc/pi-chat-ui -s pi-chat-ui
npx skills add skywangc/pi-chat-ui -s pi-chat-interactions
npx skills add skywangc/pi-chat-ui -s pi-chat-sidebar

# 全局安装
npx skills add skywangc/pi-chat-ui -s pi-chat-ui -g

# 更新
npx skills check && npx skills update
```

`-s` 指定要安装的技能名；省略 `-s` 会安装仓库内全部技能。

也可以用 Git 克隆后按需复制：

```bash
git clone https://github.com/skywangc/pi-chat-ui.git
cp -r pi-chat-ui/skills/pi-chat-ui .agents/skills/        # 按需换技能目录名
```

每个技能目录保留 `SKILL.md`、`references/`、`assets/` 的相对结构，可放入任何支持技能的目录。

## 添加新技能

1. 新建 `skills/<技能名>/`，入口为 `SKILL.md`（frontmatter：`name` + `description`）；
2. 按需带 `references/`（按任务读取的规范）、`assets/`（token CSS、纯函数参考实现、离线样板）、`scripts/validate_bundle.py`（离线自检）、`licenses/`（上游归属）；
3. 跑通包内校验后，在本 README 的技能表中加一行。

## 许可与来源

本仓库按 [Apache-2.0](LICENSE) 分发。各技能的提炼来源、上游归属与第三方许可保留在各自 `licenses/` 中；复制资产时同时保留对应声明。
