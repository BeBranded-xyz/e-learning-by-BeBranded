# e-learning by BeBranded

A **reusable, embeddable e-learning module** for existing applications (ERPs, business web apps, client portals).
Instead of rebuilding training features in every product, we maintain **one versioned module**. Each host product adds its own branding (colors, typography, theme) and plugs in its own users and roles.

> **Status: phases 1 (foundations), 2 (video), 3 (quizzes), 4 (back-office) and 4b (editor extensions) done, not published yet.** Text, video and quiz lessons, verified video completion, server-graded quizzes, access rules, assignments, progress, reports, multi-column lessons, PDF and Word export, the learner UI and the back-office work end to end in the demo app. The pilot comes next (see the [roadmap](docs/specifications/09-roadmap.md)).

**Live demo**: https://e-learning.bebranded.xyz (fictional profiles and sample content).

## Restyle it: one design file

Every color (light and dark), font, radius and spacing comes from one file, [`apps/demo/elearning.design.ts`](apps/demo/elearning.design.ts), validated by `defineDesign`. It drives the shell, the learner pages, the back-office and the PDF and Word exports. The module draws its buttons, fields, badges and tables through a swappable UI kit; the demo uses the shadcn/ui kit, also published as a shadcn registry (`https://e-learning.bebranded.xyz/r/`). See [spec 11](docs/specifications/11-design-system.md).

## Try it locally

Requires Node.js 24 (see `.node-version`), Corepack, Docker (for PostgreSQL) and ffmpeg (the seed downloads and encodes two short video excerpts).

```sh
corepack pnpm install
corepack pnpm build
docker run -d --name elearning-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16-alpine
export ELEARNING_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
corepack pnpm --filter @bebranded/elearning-demo seed
corepack pnpm --filter @bebranded/elearning-demo exec playwright install chromium  # PDF export
corepack pnpm --filter @bebranded/elearning-demo dev
```

Open http://localhost:3000/ to start as a learner. The compact toolbar switches between learner, manager, administrator and signed-out profiles, and between English and French. These profiles are fictional, not authentication. The chosen interface language follows the browser initially and then persists in a cookie; authored course content retains its own language. The seed includes an example course in French. The training admin persona opens the back-office at http://localhost:3000/admin; uploaded images are kept in the system's temporary directory. "Workplace safety" can be downloaded as PDF or Word by learners; set `DEMO_PUBLIC_URL` when the demo is not served on http://localhost:3000, so links in exported files open its lesson pages.

| Command | What it runs |
|---|---|
| `make check` | Secret scans, doc links, format, lint, typecheck, unit, component and integration tests with coverage, dead code, licenses |
| `corepack pnpm test:e2e` | Playwright journeys on the demo app, desktop and mobile (starts PostgreSQL with Testcontainers) |

## Packages

| Package | Role |
|---|---|
| `@bebranded/elearning-core` | Domain types, schemas, access rules, progress, lesson document validation, API contract types |
| `@bebranded/elearning-db` | PostgreSQL migrations, `elearning migrate`, storage adapter |
| `@bebranded/elearning-editor` | BlockNote block schema, server-side lesson HTML rendering |
| `@bebranded/elearning-server` | Learner and admin HTTP API (Web Request/Response), event delivery |
| `@bebranded/elearning-next` | Next.js App Router route handlers |
| `@bebranded/elearning-video` | Video provider adapters: Cloudflare Stream, plus an in-memory fake for tests |
| `@bebranded/elearning-react` | Learner components, hooks and styles |

## What it does

- **Structured content**: courses › chapters › lessons (rich text, video, quiz).
- **Notion-like editor**: lessons are authored with a block editor ([BlockNote](https://www.blocknotejs.org/)). Type `/` to insert headings, lists, callouts, images and more.
- **Verified video watching**: the module tracks the segments a learner has actually watched, not just the "video ended" event.
- **Interactive quizzes**: graded server-side, with a passing score and an attempt limit.
- **Progress tracking** per learner, chapter and course.
- **Role- and grade-based permissions**: each user only sees the content meant for them.
- **Admin back-office** for content management.
- **Embeddable front end**: themeable React components that live inside the host product.
- **Two data modes**: tables inside the host product's database, or a database dedicated to the module.

## What it does not do

- **Authentication**: the host product knows who is signed in. The module consumes that identity and never creates its own.
- **Standalone LMS**: no marketplace, no payments, no public course pages.
- **SCORM / xAPI**: out of scope for v1 (see [open questions](docs/specifications/09-roadmap.md#open-questions)).

## Specifications

| # | Document | Contents |
|---|----------|----------|
| 01 | [Vision and goals](docs/specifications/01-vision-and-goals.md) | Problem, goals, success criteria, scope |
| 02 | [Architecture](docs/specifications/02-architecture.md) | Monorepo, packages, flows, technical decisions |
| 03 | [Data model](docs/specifications/03-data-model.md) | PostgreSQL schema, statuses, migrations |
| 04 | [Host integration](docs/specifications/04-integration.md) | Integration contract, identity, data modes, theming, events |
| 05 | [Permissions](docs/specifications/05-permissions.md) | Audiences, access rules, RLS |
| 06 | [Video and watch verification](docs/specifications/06-video.md) | Providers, segment tracking, anti-cheat |
| 07 | [Quizzes](docs/specifications/07-quizzes.md) | SurveyJS, server-side grading, attempts |
| 08 | [Non-functional requirements](docs/specifications/08-non-functional-requirements.md) | Security, GDPR, accessibility, performance, testing, licensing |
| 09 | [Roadmap and open questions](docs/specifications/09-roadmap.md) | Phases, deliverables, open decisions |
| 10 | [Editor extensions](docs/specifications/10-editor-extensions.md) | Multi-column layout, PDF and Word export, clean-room rules |

## Planned stack

TypeScript · Next.js (App Router) · PostgreSQL / Supabase · React · BlockNote (editor) · SurveyJS Form Library (quiz rendering) · Cloudflare Stream (Mux / Bunny adapters) · pnpm + Turborepo · Vitest + Playwright · Changesets.

Packages will be published on npm under the `@bebranded` scope (`@bebranded/elearning-*`).

## Security

Please **do not open public issues for vulnerabilities**. See [SECURITY.md](SECURITY.md).

## Community

Contributions are welcome: read [CONTRIBUTING.md](CONTRIBUTING.md) and the [code of conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © BeBranded. You can use, modify and embed it in commercial products.

### Demo video attribution

The demo serves two 30-second excerpts (00:30–01:00 and 02:00–02:30) from
**Big Buck Bunny**, © 2008 Blender Foundation / [www.bigbuckbunny.org](https://www.bigbuckbunny.org/),
under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
The [film's reuse terms](https://peach.blender.org/about/) permit excerpts with attribution.
The source is the [Mux public test stream](https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8).
The seed trims and re-encodes these excerpts as VP9/AAC HLS in the ignored
`apps/demo/.demo-video/` folder; media files are not part of the MIT source distribution.
It needs network access only when generating missing excerpts. There is no remote
iframe, advertising or third-party playback request when learners watch them.
Browser tests set `DEMO_VIDEO_FIXTURE=1` and generate isolated synthetic streams
in `.demo-video-test/`, so CI does not download external media.

The seed creates missing courses and does not replace existing authored content.
Existing demo installations should review their earlier sample courses when updating.

### Course authoring workspace

The demo back-office has a persistent left sidebar, clickable course and lesson
cards, and separate sections for structure, content, completion, access,
tracking and preview. Create chapters, add text/video/quiz lessons, edit their
content and publish through Settings. Access rules control visibility;
assignments enroll an allowed audience. Course completion can require all
required lessons or a chosen percentage. Video and quiz settings expose their
own completion thresholds.

Preview displays saved drafts with the learner renderer at desktop or mobile
width, without recording progress or attempts. The demo accepts actual MP4 or
WebM uploads (50 MiB, 15 minutes), encoded locally with ffmpeg/ffprobe. These
binaries are required for development uploads and included in the container.
The demo media adapter is intended for one server process; production hosts
supply their own video provider and persistent media lifecycle.
