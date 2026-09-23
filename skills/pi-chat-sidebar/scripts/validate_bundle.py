#!/usr/bin/env python3
"""pi-chat-sidebar 技能包离线校验：链接、资源闭包、常量一致性、协议关键词。

不联网、不读取上游仓库。任何 PASS/FAIL 都只针对包内文件。
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

FAILS: list[str] = []
CHECKS = 0


def check(condition: bool, message: str) -> None:
    global CHECKS
    CHECKS += 1
    if not condition:
        FAILS.append(message)


def strip_code(text: str) -> str:
    """剥离围栏代码块与行内代码，避免把文档里的示例链接当成真实链接。"""
    text = re.sub(r"```.*?```", "", text, flags=re.S)
    text = re.sub(r"`[^`\n]*`", "", text)
    return text


def md_links(text: str) -> list[str]:
    return re.findall(r"\[[^\]]*\]\(([^)]+)\)", text)


def main() -> int:
    check((ROOT / "SKILL.md").exists(), "缺少 SKILL.md")

    # 1. markdown 内部链接可解析
    md_files = list(ROOT.rglob("*.md"))
    check(len(md_files) >= 7, f"markdown 文档数量异常: {len(md_files)}")
    for md in md_files:
        text = strip_code(md.read_text(encoding="utf-8"))
        for link in md_links(text):
            if link.startswith(("http://", "https://", "#")):
                continue
            target = (md.parent / link.split("#")[0]).resolve()
            check(target.exists(), f"{md.relative_to(ROOT)}: 链接目标不存在 -> {link}")

    # 2. 样板 HTML 离线闭包
    board = ROOT / "assets" / "reference-board.html"
    check(board.exists(), "缺少 assets/reference-board.html")
    if board.exists():
        html = board.read_text(encoding="utf-8")
        hits = [m for m in re.findall(r"https?://[^\"'\s)]+", html) if "w3.org" not in m and "localhost" not in m]
        check(not hits, f"reference-board.html 含外部 URL: {hits[:3]}")
        check("<link" not in html and "@import" not in html, "reference-board.html 含外部资源引用")

    # 3. 状态机常量与文档基线一致
    model_ts = (ROOT / "assets" / "sidebar-model.ts").read_text(encoding="utf-8")
    expected_constants = {
        "SIDEBAR_DEFAULT_WIDTH_PX": "264",
        "SIDEBAR_MIN_WIDTH_PX": "264",
        "SIDEBAR_MAX_WIDTH_RATIO": "0.5",
        "SIDEBAR_RESIZE_KEYBOARD_STEP_PX": "16",
        "CONVERSATION_AUTO_COLLAPSE_SIDEBAR_WIDTH_PX": "360",
        "CONVERSATION_AUTO_COLLAPSE_RESIZE_IDLE_MS": "300",
    }
    for name, value in expected_constants.items():
        m = re.search(rf"{name}\s*=\s*([\d.]+)", model_ts)
        check(m is not None and m.group(1) == value, f"sidebar-model.ts 常量 {name} 应为 {value}")

    # 4. 指示器优先级链存在（error → unread → loading → none）
    for marker in ('phase === "error"', "unreadAt", 'phase === "prewarming"', "hasBackgroundWork"):
        check(marker in model_ts, f"sidebar-model.ts 缺少判定标记 {marker}")
    fn_match = re.search(r"export function deriveSidebarIndicator.*?(?=export function |$)", model_ts, flags=re.S)
    check(fn_match is not None, "sidebar-model.ts 缺少 deriveSidebarIndicator 函数")
    if fn_match:
        fn_body = fn_match.group(0)
        order = ['meta.status === "error"', 'typeof meta.unreadAt === "number"', 'phase === "prewarming"']
        positions = [fn_body.find(marker) for marker in order]
        check(
            all(p >= 0 for p in positions) and positions == sorted(positions),
            "sidebar-model.ts 指示器优先级顺序被破坏（应为 error 回退 → unread → loading）",
        )

    # 5. 文档中的关键数值
    layout_doc = (ROOT / "references" / "layout-resize.md").read_text(encoding="utf-8")
    for value in ("264", "0.5", "16", "360", "300"):
        check(value in layout_doc, f"layout-resize.md 缺少常量值 {value}")
    row_doc = (ROOT / "references" / "row-ui.md").read_text(encoding="utf-8")
    for value in ("1.5rem", "40px", "1s", "6"):
        check(value in row_doc, f"row-ui.md 缺少走马灯参数 {value}")

    # 6. pi 协议事实
    pi_doc = (ROOT / "references" / "pi-sessions.md").read_text(encoding="utf-8")
    for marker in ("SessionInfo", "get_state", "switch_session", "set_session_name", "new_session", "jsonl"):
        check(marker in pi_doc, f"pi-sessions.md 缺少协议关键词 {marker}")

    # 7. 许可与来源
    for required in ("licenses/ATTRIBUTION.txt", "licenses/Apache-2.0.txt", "references/sources.md", "LICENSE"):
        check((ROOT / required).exists(), f"缺少 {required}")

    status = "PASS" if not FAILS else "FAIL"
    print(f"{status}: {CHECKS - len(FAILS)}/{CHECKS} checks")
    for f in FAILS:
        print(f"  - {f}")
    return 0 if not FAILS else 1


if __name__ == "__main__":
    sys.exit(main())
