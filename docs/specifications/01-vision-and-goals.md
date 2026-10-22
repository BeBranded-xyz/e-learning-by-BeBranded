# 01 — Vision and goals

## The problem

Many of the products we build (ERPs, client web apps, 5+ projects today) need to **train their users**: onboarding, internal procedures, grade-based upskilling, compliance.

Today, every project rebuilds its own training feature. This causes three problems:

- **Duplication**: the same progress, video and quiz logic is rewritten each time.
- **Drift**: a fix or an improvement only reaches one product.
- **Cost**: every new project pays for the whole feature again.

## The answer

**One module, versioned and distributed as npm packages.** Each product installs it, configures it, and gets updates by bumping a version.

Existing LMS solutions do not fit:

| Option | Why it is ruled out |
|--------|---------------------|
| SaaS LMS (TalentLMS, 360Learning…) | The experience lives outside the product, the data lives outside our database, and pricing is per user |
| Open source LMS (ClassroomIO, LearnHouse, CourseLit) | They are standalone platforms, not modules. They are licensed under **AGPL**, which is incompatible with MIT distribution and with embedding into proprietary products. They are a **functional reference only**: no code is reused. |
| Moodle, Open edX | Heavy, PHP / Python, impossible to embed in a Next.js app |

## Goals

1. **Embeddable**: an existing Next.js product adds training in **less than a day** (install, migrate, wire identity, theme).
2. **One codebase**: 100% of the business logic (progress, video, quizzes, permissions) lives in the module. The host product only holds configuration and wiring.
3. **Updated everywhere**: a published fix spreads through a semver bump. Database migrations ship with the package.
4. **Data ownership**: data stays in the host's infrastructure, either in its own database or in a dedicated one.
5. **Trustworthy completion**: a "watched" video was actually watched, and a "passed" quiz was graded server-side.
6. **Brandable**: the module takes on the host's visual identity through design tokens, without forking.
7. **Familiar authoring**: content authors use a Notion-like block editor they already know how to use.
8. **MIT open source**: usable by anyone, including in commercial products.

## Success criteria

- The module runs in production in **at least 2 different host products**, on the same major version.
- No host product contains a fork of the module.
- Integration time measured on the 2nd product is under 1 day.
- No video or quiz completion can be obtained by tampering with the client alone (covered by dedicated e2e tests).

## v1 scope

**In scope**

- Courses › chapters › lessons hierarchy. Lesson types: rich text, video, quiz.
- Draft and published states.
- Progress per lesson, chapter and course, with a completion rate.
- Video watch verification based on segment coverage.
- Server-graded quizzes with a passing score, an attempt limit and a cooldown between attempts.
- Access rules by role and by grade, driven by the host product.
- Back-office: content CRUD, reordering, Notion-like block editor, quiz editor, video upload, learner tracking.
- Learner React components: catalog, course page, lesson player, video player, quiz.
- Theming, i18n (en / fr).
- Events (hooks) to the host product: lesson completed, course completed, quiz passed or failed.

**Out of scope for v1** (candidates for later versions)

- PDF certificates.
- Learning paths (chained courses) and prerequisites between courses.
- SCORM / xAPI.
- Virtual classrooms and live sessions.
- Forums and comments.
- Gamification (badges, leaderboards).
- Frameworks other than React / Next.js.
