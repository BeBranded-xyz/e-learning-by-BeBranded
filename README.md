# e-learning by BeBranded

A **reusable, embeddable e-learning module** for existing applications (ERPs, business web apps, client portals).
Instead of rebuilding training features in every product, we maintain **one versioned module**. Each host product adds its own branding (colors, typography, theme) and plugs in its own users and roles.

> **Status: phase 1 (foundations) done, not published yet.** Text lessons, access rules, progress, the learner UI and the admin API work end to end in the demo app. Video, quizzes and the back-office come next (see the [roadmap](docs/specifications/09-roadmap.md)).

## Try it locally

Requires Node.js 24 (see `.node-version`), Corepack and Docker (for PostgreSQL).

```sh
corepack pnpm install
corepack pnpm build
docker run -d --name elearning-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16-alpine
export ELEARNING_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
corepack pnpm --filter @bebranded/elearning-demo seed
corepack pnpm --filter @bebranded/elearning-demo dev
```

Open http://localhost:3000/sign-in and pick a demo user. Sign-in is fake and the content is synthetic.

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
