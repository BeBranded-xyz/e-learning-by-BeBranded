# Single check command (PROJECT.md section 2). Specification stage: the
# repository holds documentation only. Phase 1 replaces this with `pnpm check`
# (format, lint, typecheck, unit and integration tests) and keeps these checks.
.PHONY: check

check:
	gitleaks git --redact --no-banner .
	gitleaks dir --redact --no-banner .
	PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-doc-links.py
	git diff --check
