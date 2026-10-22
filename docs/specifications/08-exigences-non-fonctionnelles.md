# 08 — Exigences non fonctionnelles

## Sécurité

- **Le serveur fait foi** pour toute décision : accès, complétion, notation. Aucun état de progression n'est accepté tel quel depuis le client.
- Validation Zod de toutes les entrées. Requêtes SQL paramétrées uniquement (Kysely).
- Isolation **multi-tenant** : `tenant_id` est imposé dans toutes les requêtes par la couche de stockage, pas laissé à chaque handler. Des tests vérifient l'absence de fuite entre tenants.
- Contenu texte stocké en JSON structuré et rendu sans `dangerouslySetInnerHTML`. Les liens et embeds passent par une liste blanche.
- Vidéos : URLs signées, nominatives, à durée de vie courte. Webhooks fournisseur vérifiés par signature.
- Webhooks sortants signés en HMAC-SHA256, avec un horodatage contre le rejeu.
- Rate limiting conseillé sur les heartbeats vidéo et les soumissions de quiz. Le module expose un hook `rateLimit` que l'hôte branche sur son infra (Upstash, Cloudflare…).
- Aucun secret côté client. Les packages React ne contiennent que des appels à l'API de l'hôte.

## Données personnelles (RGPD)

- Le module ne stocke que `learner_id` (pseudonyme côté module) et les données d'apprentissage. Le cache `display_name` est désactivable.
- **Droit à l'effacement** : `elearning.deleteLearnerData(learnerId)` supprime progression, tentatives et inscriptions.
- **Droit d'accès / portabilité** : `elearning.exportLearnerData(learnerId)` produit un export JSON.
- **Rétention** : durée configurable pour les données de progression des apprenants inactifs, avec une purge par job planifié (fourni comme fonction, déclenchée par l'hôte).
- Les données restent dans l'infrastructure choisie par l'hôte (sa base ou la base dédiée). Le seul tiers impliqué est le fournisseur vidéo, qui ne reçoit pas de données personnelles en dehors d'un identifiant opaque dans le token de lecture.

## Accessibilité

- Cible **WCAG 2.1 niveau AA** pour tous les composants apprenant et admin.
- Navigation clavier complète, focus visible, rôles et labels ARIA, contrastes vérifiés même avec un thème hôte (le back-office avertit si les couleurs du thème ne respectent pas les contrastes).
- Respect de `prefers-reduced-motion`.
- Tests automatisés avec axe-core dans Playwright.

## Performance

- Composants React compatibles **Server Components** : rendu serveur du catalogue et de la page de cours. Seuls le lecteur vidéo, le quiz et les interactions sont des Client Components.
- SurveyJS et l'éditeur Tiptap sont **chargés à la demande** (`dynamic import`) et absents du bundle des pages qui n'en ont pas besoin.
- Budget indicatif : moins de 30 kB gzip pour `elearning-react` hors SurveyJS et hls.js.
- Requêtes de progression d'un cours en **une seule requête SQL** agrégée (pas de N+1).
- Index sur (`learner_id`, `lesson_id`), (`course_id`, `learner_id`), (`target_type`, `target_id`), et `tenant_id` sur toutes les tables.

## Compatibilité

- Node.js ≥ 20, React ≥ 18 (19 recommandé), Next.js ≥ 14 (App Router).
- PostgreSQL ≥ 14 (Supabase, Neon, RDS, Postgres auto-hébergé).
- Navigateurs : deux dernières versions des navigateurs evergreen, Safari iOS ≥ 16.

## Qualité et tests

| Niveau | Outil | Couverture visée |
|--------|-------|------------------|
| Règles métier (core) | Vitest + fast-check (tests de propriétés) | ≥ 95 % : accès, fusion d'intervalles, plausibilité, notation |
| Stockage (db) | Vitest + Postgres éphémère (Testcontainers) | Toutes les requêtes, migrations montantes, isolation tenant |
| Handlers (server) | Vitest avec de vrais `Request` / `Response` | Tous les codes d'erreur, contrôles d'accès |
| Composants | Vitest + Testing Library | Comportements clés, accessibilité |
| End-to-end | Playwright sur `apps/demo` | Parcours complet, scénarios anti-triche vidéo et quiz, theming |

- CI GitHub Actions : lint (ESLint + Prettier), typecheck, tests et build sur chaque PR.
- **Tests de compatibilité de migration** : chaque release vérifie que les migrations s'appliquent sur une base à la version précédente qui contient des données.

## Licences

- Le module est sous **MIT**.
- **Seules sont autorisées les dépendances sous licence permissive** : MIT, ISC, BSD, Apache-2.0. Une vérification automatique en CI (`license-checker` ou équivalent) bloque toute dépendance GPL, AGPL, SSPL ou commerciale.
- Dépendances notables vérifiées : SurveyJS Form Library (MIT), Tiptap core (MIT), hls.js (Apache-2.0), Kysely (MIT), Zod (MIT).
- Explicitement exclus : SurveyJS Creator (commercial) et tout code de ClassroomIO, LearnHouse ou CourseLit (AGPL).

## Observabilité

- Logger injectable (`logger` dans la config). Par défaut on utilise `console`, et l'hôte peut brancher pino ou Sentry.
- Les erreurs inattendues des handlers sont journalisées avec un `requestId`, et l'apprenant reçoit un message générique.
- Compteurs exposés via un hook `onMetric` : heartbeats rejetés, échecs de livraison d'événements, durée des requêtes.

## Documentation

- `apps/docs` : guide d'intégration pas à pas, référence de configuration, référence API, guide de theming, guides de migration entre versions majeures.
- `apps/demo` : produit hôte fictif complet, qui sert aussi de banc de test e2e.
- CHANGELOG généré par Changesets.
