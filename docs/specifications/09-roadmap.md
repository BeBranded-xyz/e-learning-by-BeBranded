# 09 — Roadmap et questions ouvertes

## Phases

### Phase 0 : spécification *(en cours)*

- [x] Vision, périmètre, architecture, modèle de données
- [ ] Validation des questions ouvertes ci-dessous
- [ ] Choix du premier produit hôte pilote

### Phase 1 : fondations

- Monorepo (pnpm, Turborepo, Changesets, CI, vérification des licences)
- `core` : types, schémas Zod, `canAccess`, calcul de progression
- `db` : migrations initiales, `postgresStorage`, CLI `migrate`
- `server` + `next` : identité, catalogue, cours, leçons texte, complétion
- `react` : provider, theming, catalogue, page de cours, lecteur de leçon texte
- `apps/demo` avec une auth factice multi-rôles

**Livrable** : un cours composé uniquement de leçons texte, avec règles d'accès et progression, intégré dans l'app de démo.

### Phase 2 : vidéo

- `video` : adaptateur Cloudflare Stream (upload direct, webhooks, tokens signés)
- `<VideoPlayer>` avec suivi des segments, heartbeats et reprise
- Plausibilité et fusion côté serveur, tests e2e anti-triche

**Livrable** : leçons vidéo dont la complétion est vérifiée.

### Phase 3 : quiz

- Expurgation et notation serveur, tentatives, cooldown, mélange
- `<Quiz>` basé sur SurveyJS Form Library
- Correction et explications

**Livrable** : quiz notés avec seuil de réussite.

### Phase 4 : back-office

- Arbre de contenu (drag & drop), éditeur Tiptap, éditeur de quiz maison
- Gestion des règles d'accès et des assignations
- Suivi des apprenants, rapports, export CSV

**Livrable** : contenus entièrement gérables sans toucher au code.

### Phase 5 : premier produit hôte en production

- Intégration dans le produit pilote, mesure du temps d'intégration
- Événements, outbox et webhooks
- Documentation publique, première publication npm `1.0.0`

### Phase 6 : deuxième produit hôte, puis suite

- Intégration dans un 2ᵉ produit (valide la réutilisabilité)
- Adaptateurs Mux et Bunny
- Ensuite, selon les besoins : certificats, parcours et prérequis, rôles admin fins (manager d'équipe), rappels d'échéance, multilingue par cours

## Questions ouvertes

| # | Question | Options | Proposition |
|---|----------|---------|-------------|
| Q1 | Scope npm des packages | `@bebranded/elearning-*`, autre nom de marque | `@bebranded`, si le scope est disponible ou nous appartient |
| Q2 | Format du texte riche | JSON Tiptap, Markdown (MDX) | Tiptap : structure sûre, bonne UX d'édition. Markdown si les auteurs sont des développeurs. |
| Q3 | Multi-tenant dès la v1 ? | Oui (`tenant_id` partout), non | Oui : le coût est faible maintenant, alors qu'un ajout ultérieur serait coûteux et que les ERP en ont besoin |
| Q4 | Premier produit hôte pilote | ERP, web app client X… | À choisir : idéalement un produit sur Supabase avec des rôles déjà en place |
| Q5 | Fournisseur vidéo par défaut | Cloudflare Stream, Mux, Bunny | Cloudflare Stream (déjà dans notre stack) |
| Q6 | Frameworks front supportés | React seul, React + Web Components | React seul en v1, mode headless pour le reste |
| Q7 | Langue de la documentation publique | Français, anglais, les deux | Spécifications internes en français, documentation publique (`apps/docs`, README npm) en anglais pour l'audience open source |
| Q8 | SCORM / xAPI | Hors périmètre, import SCORM, émission xAPI | Hors périmètre v1. À réévaluer si un client apporte des contenus SCORM existants. |
| Q9 | Faut-il un « contrôle de présence » pendant la vidéo ? | Non, question aléatoire, détection d'inactivité | Non en v1 (voir [06 — Vidéo](06-video.md)) |
