# 02 — Architecture

## Principes

1. **Le cœur ne dépend d'aucun framework.** Les règles métier (progression, couverture vidéo, notation, accès) sont des fonctions TypeScript pures, testables sans base ni serveur.
2. **Ports et adaptateurs.** Tout ce qui varie d'un produit hôte à l'autre passe par une interface : stockage, fournisseur vidéo, identité, événements.
3. **Le serveur fait foi.** Le client affiche et envoie des signaux, mais seul le serveur décide qu'une leçon est terminée ou qu'un quiz est réussi.
4. **Standards du web.** Les handlers serveur prennent un `Request` et renvoient une `Response` (Web Fetch API). Ils se montent dans Next.js App Router, mais aussi dans Hono, Remix ou un Worker.
5. **Le produit hôte garde la main.** Il fournit l'identité, les rôles, la base de données et le thème. Le module ne crée ni utilisateur ni session.

## Monorepo

pnpm workspaces + Turborepo. Chaque package est publié séparément sur npm. Le scope `@bebranded` est provisoire (voir les [questions ouvertes](09-roadmap.md#questions-ouvertes)).

```
e-learning-by-BeBranded/
├── packages/
│   ├── core/          @bebranded/elearning-core
│   ├── db/            @bebranded/elearning-db
│   ├── server/        @bebranded/elearning-server
│   ├── video/         @bebranded/elearning-video
│   ├── react/         @bebranded/elearning-react
│   ├── admin/         @bebranded/elearning-admin
│   └── next/          @bebranded/elearning-next
├── apps/
│   ├── demo/          App Next.js de démonstration (produit hôte fictif)
│   └── docs/          Documentation publique
└── docs/specifications/
```

### Rôle de chaque package

| Package | Contenu | Dépend de |
|---------|---------|-----------|
| **core** | Types du domaine, schémas de validation (Zod), règles métier pures : calcul de progression, fusion des segments vidéo, notation des quiz, évaluation des règles d'accès. Interfaces des ports (`StorageAdapter`, `VideoProvider`, `IdentityResolver`, `EventSink`). | rien (hors Zod) |
| **db** | Migrations SQL PostgreSQL versionnées, implémentation `StorageAdapter` (Kysely sur Postgres, compatible Supabase), politiques RLS optionnelles, CLI `elearning migrate`. | core |
| **server** | Handlers HTTP framework-agnostiques (API apprenant et API admin), orchestration des cas d'usage, émission des événements. | core |
| **video** | Adaptateurs `VideoProvider` : Cloudflare Stream (par défaut), Mux, Bunny Stream. Upload direct, URLs signées, webhooks de transcodage. | core |
| **react** | Composants apprenant : `<CourseCatalog>`, `<CoursePage>`, `<LessonPlayer>`, `<VideoPlayer>`, `<Quiz>`, `<ProgressBar>`. `<ElearningProvider>` (client API, thème, i18n). | core |
| **admin** | Composants back-office : arbre de contenu avec drag & drop, éditeur de texte riche, éditeur de quiz, gestion des règles d'accès, tableau de suivi des apprenants. | core, react |
| **next** | Intégration clé en main pour Next.js : `createElearningRouteHandler()`, helpers Server Components, middleware. Fine couche au-dessus de `server`. | server |

Un produit hôte Next.js installe en général `elearning-next`, `elearning-db`, `elearning-video`, `elearning-react` et, s'il a un back-office, `elearning-admin`.

## Vue d'ensemble

```mermaid
flowchart LR
  subgraph Host["Produit hôte (Next.js)"]
    UI["Pages de l'hôte<br/>+ composants @elearning-react / admin"]
    Route["app/api/elearning/[...path]/route.ts<br/>createElearningRouteHandler()"]
    Auth["Auth de l'hôte<br/>(session, rôles, grades)"]
  end

  subgraph Module["Module e-learning"]
    Server["elearning-server<br/>cas d'usage"]
    Core["elearning-core<br/>règles métier pures"]
    DB["elearning-db<br/>StorageAdapter"]
    Video["elearning-video<br/>VideoProvider"]
  end

  PG[("PostgreSQL<br/>schéma « elearning »<br/>base hôte OU base dédiée")]
  CF["Cloudflare Stream<br/>(ou Mux / Bunny)"]
  Hooks["Événements → hôte<br/>(certificat, notification, ERP…)"]

  UI -- fetch JSON --> Route
  Route --> Server
  Auth -- IdentityResolver --> Server
  Server --> Core
  Server --> DB --> PG
  Server --> Video --> CF
  UI -- lecture vidéo signée --> CF
  Server -- EventSink --> Hooks
```

## Flux principaux

### Lecture d'une leçon vidéo

1. Le composant `<LessonPlayer>` appelle `GET /lessons/:id`.
2. Le serveur résout l'apprenant via `IdentityResolver`, vérifie l'accès (règles d'audience) et renvoie la leçon avec un **token de lecture signé** à courte durée de vie.
3. Le `<VideoPlayer>` lit la vidéo chez le fournisseur et suit localement les intervalles réellement regardés.
4. Toutes les 15 s, puis à la pause et à la fermeture de la page (`sendBeacon`), le client envoie `POST /lessons/:id/video-progress` avec les nouveaux intervalles.
5. Le serveur contrôle la plausibilité des intervalles, les fusionne et recalcule la couverture. Si elle atteint le seuil, il passe la leçon à `completed` et émet `lesson.completed`.

Le détail est dans [06 — Vidéo](06-video.md).

### Passage d'un quiz

1. `GET /quizzes/:id` renvoie le JSON SurveyJS **expurgé des bonnes réponses**.
2. L'apprenant répond. `POST /quizzes/:id/attempts` envoie les réponses brutes.
3. Le serveur vérifie les droits (tentatives restantes, délai), note avec le modèle complet, enregistre la tentative et renvoie le score. Il ne renvoie les corrections que si le quiz est configuré pour les afficher.

Le détail est dans [07 — Quiz](07-quiz.md).

## Décisions techniques

| # | Décision | Alternatives considérées | Raison |
|---|----------|--------------------------|--------|
| D1 | **Monorepo multi-packages** plutôt qu'un package unique | Un seul package, copier-coller par projet | Le produit hôte n'embarque que ce qu'il utilise (sans admin, pas de dépendances d'éditeur). Versionnage coordonné via Changesets. |
| D2 | **PostgreSQL** comme unique cible de stockage en v1, schéma dédié `elearning` | ORM multi-SGBD, Supabase uniquement | Nos produits sont sur Postgres / Supabase. Un schéma dédié évite les collisions de noms dans la base hôte. L'interface `StorageAdapter` laisse la porte ouverte à d'autres bases. |
| D3 | **Kysely** pour l'accès aux données, migrations SQL brutes | Prisma, Drizzle, client Supabase | Kysely ne génère rien côté hôte, fonctionne avec n'importe quelle connexion Postgres (pool hôte, Supabase, Neon) et cohabite avec l'ORM de l'hôte. Les migrations en SQL brut restent lisibles et rejouables. |
| D4 | **Handlers Web `Request` / `Response`** | Server Actions uniquement, API tRPC | Portables hors Next.js, testables sans framework. Les Server Actions restent possibles via `elearning-next`. |
| D5 | **SurveyJS Form Library (MIT)** pour le rendu des quiz | Moteur de quiz maison, Typeform | Moteur mature, accessible, avec de nombreux types de questions. **SurveyJS Creator n'est pas MIT** (licence commerciale) : l'éditeur de quiz du back-office est donc développé par nous et produit du JSON SurveyJS. |
| D6 | **Cloudflare Stream** par défaut, derrière une interface `VideoProvider` | YouTube / Vimeo, fichiers bruts sur S3 | URLs signées, streaming adaptatif, coût prévisible, et BeBranded est déjà sur Cloudflare. YouTube et Vimeo ne permettent ni un contrôle d'accès fiable ni un suivi fin. |
| D7 | **Texte riche stocké en JSON Tiptap / ProseMirror** | Markdown, HTML | Structure validable, pas d'injection HTML, rendu contrôlé, éditeur Tiptap sous MIT. À confirmer (voir les questions ouvertes). |
| D8 | **Theming par CSS custom properties** (`--el-*`), sans framework CSS imposé | Tailwind preset, styled-components | Fonctionne quelle que soit la stack CSS de l'hôte. Un preset Tailwind optionnel peut mapper les tokens. |
| D9 | **Identité fournie par l'hôte** via `IdentityResolver` | Auth propre au module, Supabase Auth imposé | Chaque produit a déjà son auth. Le module ne stocke qu'un `learner_id` opaque. |

## Versionnage et distribution

- **Semver strict**, une version par package, coordonnée avec Changesets.
  - *patch* : correctifs sans migration.
  - *minor* : nouvelles fonctionnalités et migrations **additives** (nouvelles tables ou colonnes nullables).
  - *major* : changement d'API ou migration non rétrocompatible, avec un guide de migration.
- **Migrations livrées dans `elearning-db`**. L'hôte lance `pnpm elearning migrate` en CI ou au déploiement. Une table `elearning.schema_migrations` trace les migrations appliquées.
- Le module vérifie au démarrage que la version du schéma est compatible avec celle du code, et sinon renvoie une erreur explicite.
- Les produits hôtes reçoivent les mises à jour via Renovate ou Dependabot.
- Publication npm depuis GitHub Actions, avec provenance npm.
