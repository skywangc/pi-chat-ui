#!/usr/bin/env python3
"""Offline integrity checks. No third-party modules or upstream checkout required."""
from pathlib import Path
import json
import re
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]


def require(condition, message):
    if not condition:
        raise SystemExit(message)


for relative in ["SKILL.md", "references/integration.md", "references/component-recipes.md",
                 "assets/chat-ui-tokens.css", "assets/chat-ui-components.css",
                 "assets/reference-board.html", "licenses/Apache-2.0.txt"]:
    require((ROOT / relative).is_file(), f"Missing required file: {relative}")

for document in [ROOT / "SKILL.md", *sorted((ROOT / "references").glob("*.md"))]:
    for target in re.findall(r"\]\(([^)]+)\)", document.read_text()):
        if re.match(r"https?://|#", target):
            continue
        target = target.split("#", 1)[0]
        resolved = (document.parent / target).resolve()
        require(resolved.is_relative_to(ROOT), f"Link escapes bundle: {document.name}: {target}")
        require(resolved.exists(), f"Broken link: {document.name}: {target}")

css_paths = list((ROOT / "assets").glob("*.css"))
css = "\n".join(p.read_text() for p in css_paths)
require(not re.search(r"@import|url\s*\(", css), "CSS must not fetch external resources")
declared = set(re.findall(r"(--[\w-]+)\s*:", css))
referenced = set(re.findall(r"var\(\s*(--[\w-]+)", css))
require(not referenced - declared, f"Undefined CSS variables: {referenced - declared}")

tokens = (ROOT / "assets/chat-ui-tokens.css").read_text()
base_match = re.search(r"\.chat-ui-root\s*\{([^}]+)\}", tokens)
require(base_match is not None, "Missing scoped base tokens")
base = set(re.findall(r"(--[\w-]+)\s*:", base_match.group(1)))
for mode in ("light", "dark"):
    match = re.search(r'\.chat-ui-root\[data-theme="' + mode + r'"\]\s*\{([^}]+)\}', tokens)
    require(match is not None, f"Missing theme: {mode}")
    local = set(re.findall(r"(--[\w-]+)\s*:", match.group(1)))
    require(not referenced - base - local, f"Incomplete {mode} theme: {referenced - base - local}")


class ResourceParser(HTMLParser):
    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        keys = ("src",) if tag in ("script", "img", "iframe", "source") else ("href",) if tag in ("link", "use") else ()
        for key in keys:
            value = values.get(key, "")
            if not value or value.startswith("#"):
                continue
            require(not re.match(r"[a-z]+:|//|/", value), f"Non-portable HTML resource: {value}")
            target = (ROOT / "assets" / value).resolve()
            require(target.is_relative_to(ROOT) and target.is_file(), f"Missing HTML resource: {value}")


html = (ROOT / "assets/reference-board.html").read_text()
ResourceParser().feed(html)
require(not re.search(r"\bfetch\s*\(|XMLHttpRequest|WebSocket\s*\(", html), "Offline board must not request a backend")
fixture = json.loads((ROOT / "assets/rpc-replay.json").read_text())
for event in fixture["events"]:
    if event["type"] == "message_update":
        require("message" not in event, "RPC update must not contain SDK message snapshot")
        require("partial" not in event["assistantMessageEvent"], "RPC update must not contain SDK partial")
require(fixture["events"][-1]["type"] == "agent_settled", "Replay must settle")
print(f"PASS: local links, standalone light/dark CSS, offline HTML resources, {len(fixture['events'])} RPC events")
