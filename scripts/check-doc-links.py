"""Fail when a Markdown file links to a repository file that does not exist.

Checks relative links in every tracked or new (not ignored) Markdown file.
External URLs, mailto links and in-page anchors are skipped; fenced code blocks
are ignored so that examples are not treated as links.
"""

from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
LINK = re.compile(r'\[[^\]]*\]\(([^)\s]+)\)')
FENCE = re.compile(r'^\s*(```|~~~)')
EXTERNAL = ('http://', 'https://', 'mailto:', '#')


def markdown_files() -> list[Path]:
    listed = subprocess.run(
        ['git', 'ls-files', '--cached', '--others', '--exclude-standard', '*.md'],
        cwd=ROOT, capture_output=True, text=True, check=True,
    ).stdout.split('\n')
    return [ROOT / name for name in listed if name and (ROOT / name).is_file()]


def broken_links(path: Path) -> list[str]:
    broken, in_fence = [], False
    for number, line in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
        if FENCE.match(line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        for target in LINK.findall(line):
            if target.startswith(EXTERNAL):
                continue
            file_part = target.split('#', 1)[0]
            if file_part and not (path.parent / file_part).exists():
                broken.append(f'{path.relative_to(ROOT)}:{number}: {target}')
    return broken


def main() -> int:
    problems = [item for path in markdown_files() for item in broken_links(path)]
    for problem in problems:
        print(f'broken link: {problem}', file=sys.stderr)
    print(f'check-doc-links: {len(problems)} broken link(s)')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
