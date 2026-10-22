# 01 — Vision et objectifs

## Le problème

Plusieurs produits que nous développons (ERP, web apps clients, plus de 5 projets aujourd'hui) ont besoin de **former leurs utilisateurs** : onboarding, procédures internes, montée en compétence par grade, conformité.

Aujourd'hui, chaque projet recode sa propre brique de formation. Cela pose trois problèmes :

- **Duplication** : la même logique de progression, de vidéo et de quiz est réécrite à chaque fois.
- **Dérive** : un correctif ou une amélioration n'atteint qu'un seul produit.
- **Coût** : chaque nouveau projet paie à nouveau toute la brique.

## La réponse

**Un module unique, versionné et distribué en packages npm.** Chaque produit l'installe, le configure et le met à jour par une simple montée de version.

Les solutions LMS existantes ne conviennent pas :

| Option | Pourquoi elle est écartée |
|--------|---------------------------|
| LMS SaaS (TalentLMS, 360Learning…) | Expérience hors du produit, données hors de notre base, coût par utilisateur |
| LMS open source (ClassroomIO, LearnHouse, CourseLit) | Ce sont des plateformes autonomes, pas des modules. Elles sont sous **AGPL**, ce qui est incompatible avec une distribution MIT et une intégration dans des produits propriétaires. Elles servent de **référence fonctionnelle uniquement** : aucune reprise de code. |
| Moodle, Open edX | Lourds, en PHP / Python, impossibles à embarquer dans une app Next.js |

## Objectifs

1. **Intégrable** : un produit Next.js existant ajoute la formation en **moins d'une journée** (installation, migration, branchement de l'identité, theming).
2. **Un seul code** : 100 % de la logique métier (progression, vidéo, quiz, permissions) vit dans le module. Le produit hôte ne contient que de la configuration et du câblage.
3. **Mis à jour partout** : un correctif publié se propage par une montée de version semver. Les migrations de base sont livrées avec le package.
4. **Données maîtrisées** : les données restent dans l'infrastructure du produit hôte, au choix dans sa propre base ou dans une base dédiée.
5. **Fiable sur la complétion** : une vidéo « vue » l'a vraiment été, et un quiz « réussi » a été noté côté serveur.
6. **Brandable** : le module prend l'identité visuelle du produit hôte sans fork, via des design tokens.
7. **Open source MIT** : utilisable par tout le monde, y compris dans des produits commerciaux.

## Critères de succès

- Le module est en production dans **au moins 2 produits hôtes** différents, avec la même version majeure.
- Aucun fork du module n'existe dans un produit hôte.
- Le temps d'intégration mesuré sur le 2ᵉ produit est inférieur à 1 jour.
- Aucune complétion de vidéo ou de quiz n'est possible en manipulant uniquement le client (vérifié par des tests e2e dédiés).

## Périmètre v1

**Inclus**

- Hiérarchie cours › chapitres › leçons. Types de leçon : texte riche, vidéo, quiz.
- Brouillon et publication des contenus.
- Progression par leçon, chapitre et cours, avec un taux de complétion.
- Vérification du visionnage vidéo par couverture des segments.
- Quiz notés côté serveur, avec seuil de réussite, nombre de tentatives et délai entre deux tentatives.
- Règles d'accès par rôle et par grade, définies par le produit hôte.
- Back-office : CRUD des contenus, réordonnancement, éditeur de quiz, upload vidéo, suivi des apprenants.
- Composants React apprenant : catalogue, page de cours, lecteur de leçon, lecteur vidéo, quiz.
- Theming, i18n fr / en.
- Événements (hooks) vers le produit hôte : leçon terminée, cours terminé, quiz réussi ou échoué.

**Exclus de la v1** (candidats aux versions suivantes)

- Certificats PDF.
- Parcours (enchaînement de plusieurs cours) et prérequis entre cours.
- SCORM / xAPI.
- Classes virtuelles et live.
- Forum et commentaires.
- Gamification (badges, classement).
- Frameworks autres que React / Next.js.
