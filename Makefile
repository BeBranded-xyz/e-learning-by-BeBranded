# Single check command (PROJECT.md section 2): secret scans and doc links,
# then `pnpm check` (format, lint, typecheck, tests with coverage, dead code,
# licenses).
.PHONY: check

check:
	gitleaks git --redact --no-banner .
	gitleaks dir --redact --no-banner .
	PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-doc-links.py
	git diff --check
	corepack pnpm check
