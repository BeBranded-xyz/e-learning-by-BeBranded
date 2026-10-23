# 05 — Permissions

The requirement: **not every user sees the same content**. What a user sees depends on their role or grade in the host product.

## Two separate levels

1. **Administration**: who can manage content and see tracking. The host product decides through `Learner.isAdmin`. v1 has a single admin level. Finer admin roles (author, reviewer, team manager) are planned for later.
2. **Content access**: who sees which course, chapter or lesson. The module handles this through **audience rules** defined in the back-office.

## Audiences

A rule targets a course, a chapter or a lesson, and describes an audience:

| `audience_type` | `audience_value` | Meaning |
|-----------------|------------------|---------|
| `everyone` | — | Every authenticated learner of the tenant |
| `role` | `"manager"` | Learners with this role in the host |
| `grade_min` | `"3"` | Learners whose grade is ≥ 3 |
| `learner` | `"<learner_id>"` | One specific learner |

Each rule has an `allow` or `deny` effect.

Roles and grades come from the host (`Learner.roles`, `Learner.grade`). The module does not maintain its own role registry. The host can provide the list of available roles (`listRoles()`) to populate the back-office menus.

## Evaluation algorithm

For a given learner and target (e.g. a lesson):

1. The content and all its parents must be `published`. Otherwise it is invisible.
2. Rules are evaluated **from parent to child**: course, then chapter, then lesson.
3. At each level:
   - no rule → the level **inherits** the parent's decision;
   - at least one matching `deny` rule → **denied** (`deny` always wins);
   - at least one matching `allow` rule → **allowed**;
   - `allow` rules exist but none matches → **denied**;
   - only `deny` rules exist and none matches → the level **inherits** the parent's decision.
4. A course is **denied by default** unless an `allow` rule matches the learner: a course with no rule, or with only `deny` rules, is invisible. It needs an explicit rule, `everyone` at minimum. This prevents publishing sensitive content to everyone by mistake. The back-office suggests `everyone` as the initial rule when creating a course.
5. A child cannot grant more access than its parent. A learner cannot see a lesson without access to its course.

Evaluation is a pure function in `elearning-core`:

```ts
canAccess(learner: Learner, path: ContentPath, rules: AccessRule[]): AccessDecision
```

It is tested exhaustively (property-based tests).

## Enforcement

- **Always server-side.** Every learner handler filters its results with `canAccess`. The client never receives content it cannot access, not even hidden.
- **Video URLs** are signed per learner and only issued after the access check.
- **Editor files** (images, attachments) are served through signed URLs, only for lessons the learner can access.
- **Progress** only counts accessible lessons (see [03 — Data model](03-data-model.md#computation-rules)).
- **Role changes**: access is re-evaluated on every request, since identity is never cached. Earned progress is kept but no longer shown for content that became inaccessible.
- **Multi-tenant**: every query is filtered by `tenant_id`, enforced in the storage layer. Content with `tenant_id null` can be declared **shared** across tenants (`sharedCatalog` option), for a catalog common to all companies of an ERP.

## Enrollment and assignment

Access (being allowed to see a course) is separate from enrollment (the course appears in "My training", possibly with a due date).

- A course is either **self-enroll** (learners enroll themselves) or **assignment-only**.
- An admin can assign a course to a learner, a role or a grade, with an optional due date. Assigning to a role creates the enrollments on the learner's next visit (`source = auto`).
- The back-office refuses to assign a course to someone who cannot access it (`canAssign` in `elearning-core`). Only the course's own rules count, and a draft course is judged as if published, so an assignment can be prepared before publication:
  - **a role or a grade**: a member with only that role, or exactly that grade, must be allowed;
  - **a learner**: the back-office does not know their roles and grade, so it refuses only when no rule could ever let them in (no `allow` rule that may match them, or a `deny` rule for `everyone` or for them).
- Access is checked again with the learner's real identity before an enrollment is created, and on every request after that.

## RLS

By default, tables are only accessed through the server handlers, using a service connection. For a Supabase host that wants to read the tables directly from its own code (reporting, SQL views), `elearning-db` provides an **optional** migration with RLS policies:

- progress tables: `learner_id = auth.uid()::text`;
- content tables: read access to published content filtered by an `elearning.can_access(...)` SQL function that mirrors the algorithm above;
- writes reserved to the service role.

This option requires roles and grades to be readable in SQL (JWT claims). It remains opt-in and is documented as such.
