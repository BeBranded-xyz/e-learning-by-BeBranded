# 04 — Intégration dans un produit hôte

Ce document décrit le **contrat** entre le module et le produit qui l'embarque. Il se résume à quatre ports : identité, stockage, vidéo et événements. S'y ajoutent le montage des routes et le thème.

## Exemple d'intégration (Next.js App Router)

```ts
// lib/elearning.ts
import { createElearning } from "@bebranded/elearning-server";
import { postgresStorage } from "@bebranded/elearning-db";
import { cloudflareStream } from "@bebranded/elearning-video";
import { getSession } from "@/lib/auth"; // auth de l'hôte

export const elearning = createElearning({
  storage: postgresStorage({
    connectionString: process.env.ELEARNING_DATABASE_URL!, // base hôte ou base dédiée
    schema: "elearning",
  }),
  video: cloudflareStream({
    accountId: process.env.CF_ACCOUNT_ID!,
    apiToken: process.env.CF_STREAM_TOKEN!,
    signingKey: process.env.CF_STREAM_SIGNING_KEY!,
  }),
  identity: async (request) => {
    const session = await getSession(request);
    if (!session) return null;
    return {
      learnerId: session.user.id,
      tenantId: session.user.companyId,  // null si mono-tenant
      roles: session.user.roles,         // ex. ["employee", "manager"]
      grade: session.user.grade,         // ex. 3 (optionnel)
      isAdmin: session.user.roles.includes("training_admin"),
      displayName: session.user.name,
      locale: session.user.locale,
    };
  },
  events: {
    "course.completed": async (e) => { /* ex. générer une attestation dans l'ERP */ },
  },
});
```

```ts
// app/api/elearning/[...path]/route.ts
import { createElearningRouteHandler } from "@bebranded/elearning-next";
import { elearning } from "@/lib/elearning";

export const { GET, POST, PATCH, DELETE } = createElearningRouteHandler(elearning);
```

```tsx
// app/formation/[courseSlug]/page.tsx
import { ElearningProvider, CoursePage } from "@bebranded/elearning-react";
import "@bebranded/elearning-react/styles.css";

export default function Page({ params }) {
  return (
    <ElearningProvider apiBase="/api/elearning" theme={hostTheme} locale="fr">
      <CoursePage slug={params.courseSlug} />
    </ElearningProvider>
  );
}
```

## 1. Identité : `IdentityResolver`

```ts
type IdentityResolver = (request: Request) => Promise<Learner | null>;

interface Learner {
  learnerId: string;        // identifiant opaque et stable dans l'hôte
  tenantId: string | null;
  roles: string[];          // rôles de l'hôte, utilisés tels quels par les règles d'accès
  grade?: number | null;    // niveau hiérarchique ou de compétence, ordonné
  isAdmin: boolean;         // accès au back-office
  displayName?: string;
  locale?: string;
}
```

- Appelé **à chaque requête** et jamais mis en cache par le module. L'hôte reste maître de la révocation.
- `null` → 401.
- Le module ne stocke **aucune donnée personnelle** en dehors du `learner_id` (et éventuellement d'un `display_name` mis en cache pour l'admin, désactivable).
- Pour afficher les noms et e-mails dans le tableau de suivi, l'hôte fournit en option `resolveLearners(ids) → LearnerProfile[]`.

## 2. Modes de données

Les **mêmes migrations** et le **même schéma** servent aux deux modes. Seule la connexion change.

| | Mode A : base intégrée | Mode B : base dédiée |
|---|---|---|
| Où | Schéma `elearning` dans la base Postgres / Supabase du produit hôte | Base Postgres ou projet Supabase propre au module |
| Quand le choisir | Cas par défaut. Permet des jointures SQL entre les données de l'hôte et la progression (reporting ERP). | L'hôte n'est pas sur Postgres, ou il faut isoler les données de formation, ou plusieurs produits partagent un même catalogue. |
| Lien utilisateur | FK optionnelle de `learner_id` vers la table users de l'hôte | Aucune FK. `learner_id` est opaque. |
| Transactions | Possibles avec l'hôte (option `storage.withTransaction(hostTx)`) | Indépendantes |
| Migrations | `pnpm elearning migrate --schema elearning` dans le pipeline de l'hôte | Idem, sur la base dédiée |

Avec Supabase en mode A, le schéma `elearning` n'est **pas exposé** dans PostgREST par défaut : l'accès passe par les handlers serveur. L'exposition directe avec des politiques RLS est une option documentée (voir [05 — Permissions](05-permissions.md#rls)).

## 3. Vidéo : `VideoProvider`

```ts
interface VideoProvider {
  createDirectUpload(input: { maxDurationSeconds: number }): Promise<{ uploadUrl: string; assetId: string }>;
  getAsset(assetId: string): Promise<{ status: AssetStatus; durationSeconds: number | null; thumbnailUrl: string | null }>;
  createPlaybackToken(assetId: string, opts: { learnerId: string; ttlSeconds: number }): Promise<PlaybackSource>;
  deleteAsset(assetId: string): Promise<void>;
  verifyWebhook(request: Request): Promise<VideoWebhookEvent | null>;
}
```

Détails dans [06 — Vidéo](06-video.md).

## 4. Événements : `EventSink`

Le module émet des événements métier. L'hôte s'y abonne pour déclencher ses propres actions : certificat, notification, mise à jour d'une fiche RH dans l'ERP, etc.

| Événement | Payload principal |
|-----------|-------------------|
| `lesson.started` | learnerId, lessonId, courseId |
| `lesson.completed` | learnerId, lessonId, courseId |
| `quiz.attempt_submitted` | learnerId, quizId, score, passed, attemptNumber |
| `course.started` | learnerId, courseId |
| `course.completed` | learnerId, courseId, completedAt |
| `enrollment.assigned` | learnerId, courseId, assignedBy, dueAt |
| `content.published` | targetType, targetId |

- Les événements sont écrits dans `event_outbox` **dans la même transaction** que le changement d'état, puis livrés aux handlers (au moins une fois, avec retry et backoff). Les handlers de l'hôte doivent être **idempotents** (chaque événement a un `id`).
- Livraison possible en in-process (fonction) ou en webhook HTTP signé (HMAC), selon la configuration.

## 5. Branding et theming

Tous les composants consomment des **CSS custom properties** préfixées `--el-`. L'hôte les définit globalement ou via la prop `theme` de `<ElearningProvider>`.

```ts
const hostTheme = {
  colors: {
    primary: "#5B3DF5",
    primaryForeground: "#FFFFFF",
    background: "#FFFFFF",
    surface: "#F7F7F9",
    text: "#111111",
    muted: "#6B7280",
    success: "#16A34A",
    danger: "#DC2626",
    border: "#E5E7EB",
  },
  radius: "8px",
  fontFamily: "inherit",
  darkMode: "media", // "media" | "class" | "off"
};
```

- **Aucune dépendance CSS imposée.** Les styles sont livrés en CSS pur, avec une spécificité faible (`:where()`), et l'hôte peut les surcharger.
- Mode **headless** : chaque composant expose aussi un hook (`useCourse`, `useLessonPlayer`, `useQuiz`…) pour que l'hôte reconstruise l'UI avec son propre design system.
- Slots de surcharge (`components={{ LessonHeader: MyHeader }}`) pour remplacer une partie sans tout réécrire.
- Un preset Tailwind optionnel mappe les tokens `--el-*` vers les tokens de l'hôte.

## 6. i18n

- Chaînes UI en fr et en, extensibles via `messages` dans le provider.
- Le contenu des cours est monolingue par cours (champ `locale`). Le multilingue d'un même cours est hors v1.

## 7. Surface API

Toutes les routes sont relatives au point de montage (ex. `/api/elearning`). Les routes `/admin/*` exigent `isAdmin`.

**Apprenant**

| Méthode | Route | Rôle |
|---------|-------|------|
| GET | `/courses` | Catalogue filtré par les règles d'accès, avec la progression |
| GET | `/courses/:slug` | Arbre chapitres › leçons accessibles, avec la progression |
| POST | `/courses/:id/enroll` | S'inscrire (si le cours le permet) |
| GET | `/lessons/:id` | Contenu de la leçon (et token vidéo ou quiz expurgé) |
| POST | `/lessons/:id/complete` | Marquer une leçon texte comme terminée |
| POST | `/lessons/:id/video-progress` | Heartbeat vidéo |
| GET | `/quizzes/:id` | Définition expurgée, tentatives restantes |
| POST | `/quizzes/:id/attempts` | Soumettre une tentative |
| GET | `/me/progress` | Tableau de bord apprenant |

**Admin**

CRUD sur `/admin/courses`, `/admin/chapters`, `/admin/lessons`, `/admin/quizzes`, `/admin/access-rules`, `/admin/enrollments` ; `POST /admin/videos/uploads` (upload direct) ; `POST /admin/reorder` ; `GET /admin/reports/*` (suivi par cours ou par apprenant, export CSV).

**Système**

`POST /webhooks/video` reçoit les webhooks du fournisseur vidéo (signature vérifiée).

Toutes les entrées sont validées avec Zod. Les erreurs suivent un format unique `{ error: { code, message, details? } }`.
