# The demo app as one container (build context: the repository root):
#   docker build -f apps/demo/Dockerfile -t elearning-demo .
#   docker run -e ELEARNING_DATABASE_URL=postgres://… -e DEMO_PUBLIC_URL=https://… -p 3000:3000 elearning-demo
# On start it applies the migrations and seeds the demo courses (both idempotent),
# then serves the production build. PDF export uses the Chromium installed below.

FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS build
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV CI=true NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build && pnpm --filter @bebranded/elearning-demo build
# The synthetic demo video, generated once at build time so the image needs no ffmpeg.
RUN cd apps/demo && pnpm exec tsx -e 'import("./scripts/demo-video.ts").then((m) => m.ensureDemoVideo())'

FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# Headless Chromium and its system libraries, for PDF export (same version as the demo's playwright-core).
RUN npx -y playwright-core@1.64.1 install --with-deps chromium \
  && rm -rf /var/lib/apt/lists/* /root/.npm
WORKDIR /app
COPY --from=build --chown=node:node /app /app
# Uploaded files (demo FileStorage): owned by the app user, so a volume mounted here is writable.
RUN mkdir -p /tmp/elearning-demo-files && chown node:node /tmp/elearning-demo-files
USER node
WORKDIR /app/apps/demo
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD node -e "fetch('http://127.0.0.1:3000/sign-in').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["sh", "-c", "node_modules/.bin/tsx --conditions=@bebranded/source scripts/seed.ts && exec node_modules/.bin/next start --port 3000"]
