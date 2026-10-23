---
"@bebranded/elearning-db": minor
"@bebranded/elearning-server": patch
---

The migrations are now embedded in the package code, so `@bebranded/elearning-db` bundles with Next.js and other bundlers and needs no file access at runtime. The CSRF check now compares the `Origin` with the host the browser addressed (`Host` or the first `X-Forwarded-Host`): frameworks such as `next start` rewrite `request.url`, which refused legitimate writes.
