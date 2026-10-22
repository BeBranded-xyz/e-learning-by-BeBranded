# e-learning by BeBranded

Module e-learning **réutilisable et intégrable** dans des applications existantes (ERP, web apps métier, portails clients).
Plutôt que de recoder la formation dans chaque produit, on maintient **un seul module versionné**. Chaque produit hôte y ajoute son branding (couleurs, typographie, thème) et le branche sur ses propres utilisateurs et rôles.

> **Statut : spécification.** Ce dépôt contient pour l'instant les spécifications techniques. Le code arrive phase par phase (voir la [roadmap](docs/specifications/09-roadmap.md)).

## Ce que fait le module

- **Contenus hiérarchisés** : cours › chapitres › leçons (texte riche, vidéo, quiz).
- **Vidéo avec vérification du visionnage réel** : on mesure les segments effectivement regardés, pas seulement l'événement « fin de vidéo ».
- **Quiz interactifs** : notation côté serveur, seuil de réussite, nombre de tentatives.
- **Suivi de progression** par apprenant, chapitre et cours.
- **Permissions par rôle ou grade** : chaque utilisateur ne voit que les contenus qui lui sont destinés.
- **Back-office** de gestion des contenus.
- **Front intégrable** dans le produit hôte (composants React thémables).
- **Deux modes de données** : tables dans la base du produit hôte, ou base dédiée au module.

## Ce que le module ne fait pas

- **Authentification** : c'est le produit hôte qui sait qui est connecté. Le module consomme cette identité et n'en crée aucune.
- **Plateforme LMS autonome** : pas de marketplace, de paiement ni de pages publiques de cours.
- **SCORM / xAPI** : hors périmètre de la v1 (voir les [questions ouvertes](docs/specifications/09-roadmap.md#questions-ouvertes)).

## Spécifications

| # | Document | Contenu |
|---|----------|---------|
| 01 | [Vision et objectifs](docs/specifications/01-vision-objectifs.md) | Problème, objectifs, critères de succès, périmètre |
| 02 | [Architecture](docs/specifications/02-architecture.md) | Monorepo, packages, flux, décisions techniques |
| 03 | [Modèle de données](docs/specifications/03-modele-de-donnees.md) | Schéma PostgreSQL, statuts, migrations |
| 04 | [Intégration dans un produit hôte](docs/specifications/04-integration.md) | Contrat d'intégration, identité, modes de données, branding, événements |
| 05 | [Permissions](docs/specifications/05-permissions.md) | Audiences, règles d'accès, RLS |
| 06 | [Vidéo et vérification du visionnage](docs/specifications/06-video.md) | Fournisseurs, suivi des segments, anti-triche |
| 07 | [Quiz](docs/specifications/07-quiz.md) | SurveyJS, notation serveur, tentatives |
| 08 | [Exigences non fonctionnelles](docs/specifications/08-exigences-non-fonctionnelles.md) | Sécurité, RGPD, accessibilité, performance, tests, licences |
| 09 | [Roadmap et questions ouvertes](docs/specifications/09-roadmap.md) | Phases, livrables, points à trancher |

## Stack envisagée

TypeScript · Next.js (App Router) · PostgreSQL / Supabase · React · SurveyJS Form Library (MIT) · Cloudflare Stream (adaptateurs Mux / Bunny) · pnpm + Turborepo · Vitest + Playwright · Changesets.

## Licence

[MIT](LICENSE) © BeBranded. Vous pouvez l'utiliser, le modifier et l'intégrer dans des produits commerciaux.
