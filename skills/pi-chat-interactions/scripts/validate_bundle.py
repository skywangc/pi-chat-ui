#!/usr/bin/env python3
"""pi-chat-interactions 技能包离线校验：链接、资源闭包、常量一致性。

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
    skill = ROOT / "SKILL.md"
    check(skill.exists(), "缺少 SKILL.md")

    # 1. markdown 内部链接可解析（跳过 http/https/anchor）
    md_files = list(ROOT.rglob("*.md"))
    check(len(md_files) >= 6, f"markdown 文档数量异常: {len(md_files)}")
    for md in md_files:
        text = strip_code(md.read_text(encoding="utf-8"))
        for link in md_links(text):
            if link.startswith(("http://", "https://", "#")):
                continue
            target = (md.parent / link.split("#")[0]).resolve()
            check(target.exists(), f"{md.relative_to(ROOT)}: 链接目标不存在 -> {link}")

    # 2. 样板 HTML 不引用外部资源（离线闭包）
    board = ROOT / "assets" / "reference-board.html"
    check(board.exists(), "缺少 assets/reference-board.html")
    if board.exists():
        html = board.read_text(encoding="utf-8")
        for pattern, what in [
            (r"https?://[^\"'\s)]+", "外部 URL"),
            (r"<link[^>]+href=", "外部 link"),
            (r"@import", "CSS @import"),
        ]:
            hits = [m for m in re.findall(pattern, html) if "w3.org" not in m and "localhost" not in m]
            check(not hits, f"reference-board.html 含{what}: {hits[:3]}")

    # 3. 状态机常量与文档基线一致（防抄写漂移）
    anchor_ts = (ROOT / "assets" / "scroll-anchor.ts").read_text(encoding="utf-8")
    expected_constants = {
        "BOTTOM_ANCHOR_EPSILON_PX": "48",
        "UNOBSERVED_SCROLL_EPSILON_PX": "2",
        "USER_SCROLL_INTENT_TTL_MS": "1200",
        "LAYOUT_SCROLL_GUARD_MS": "250",
        "LOAD_OLDER_TRIGGER_PX": "64",
        "LOAD_OLDER_PREFETCH_VIEWPORTS": "2",
        "CONTENT_WIDTH_RESIZE_SETTLE_MS": "120",
    }
    for name, value in expected_constants.items():
        m = re.search(rf"{name}\s*=\s*(\d+)", anchor_ts)
        check(m is not None and m.group(1) == value, f"scroll-anchor.ts 常量 {name} 应为 {value}")

    # 4. 文档中的关键常量数值与实现一致
    scroll_doc = (ROOT / "references" / "scroll-following.md").read_text(encoding="utf-8")
    for value in ("48", "1200", "250", "64", "120"):
        check(value in scroll_doc, f"scroll-following.md 缺少常量值 {value}")

    # 5. fuzzy 打分档位存在
    fuzzy = (ROOT / "assets" / "fuzzy-match.ts").read_text(encoding="utf-8")
    for marker in ("100 +", "200", "450", "300", "25", "SUGGESTION_DISPLAY_CAP = 1000"):
        check(marker in fuzzy, f"fuzzy-match.ts 缺少打分标记 {marker}")

    # 6. pi 协议事实（避免文档与协议脱节）
    slash_doc = (ROOT / "references" / "slash-commands.md").read_text(encoding="utf-8")
    for marker in ("get_commands", "extension", "prompt", "skill", "RpcSlashCommand"):
        check(marker in slash_doc, f"slash-commands.md 缺少协议关键词 {marker}")
    attach_doc = (ROOT / "references" / "attachments-paste.md").read_text(encoding="utf-8")
    for marker in ("ImageContent", "images", "steer", "follow_up", "prompt"):
        check(marker in attach_doc, f"attachments-paste.md 缺少协议关键词 {marker}")

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
