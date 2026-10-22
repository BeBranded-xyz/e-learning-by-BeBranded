# 05 — Permissions

Le besoin : **chaque utilisateur ne voit pas forcément les mêmes contenus**, selon son rôle ou son grade dans le produit hôte.

## Deux niveaux distincts

1. **Administration** : qui peut gérer les contenus et voir le suivi. Le produit hôte le décide via `Learner.isAdmin`. La v1 n'a qu'un seul niveau admin. Des rôles admin plus fins (auteur, relecteur, manager qui suit son équipe) sont prévus pour plus tard.
2. **Accès aux contenus** : qui voit quel cours, chapitre ou leçon. C'est géré par le module, via des **règles d'audience** définies dans le back-office.

## Audiences

Une règle cible un cours, un chapitre ou une leçon, et décrit une audience :

| `audience_type` | `audience_value` | Signification |
|-----------------|------------------|---------------|
| `everyone` | — | Tous les apprenants authentifiés du tenant |
| `role` | `"manager"` | Apprenants ayant ce rôle dans l'hôte |
| `grade_min` | `"3"` | Apprenants dont le grade est ≥ 3 |
| `learner` | `"<learner_id>"` | Un apprenant précis |

Chaque règle a un effet `allow` ou `deny`.

Les rôles et grades viennent de l'hôte (`Learner.roles`, `Learner.grade`). Le module ne maintient pas de référentiel de rôles. L'hôte peut lui fournir la liste des rôles disponibles (`listRoles()`) pour alimenter les menus du back-office.

## Algorithme d'évaluation

Pour un apprenant et une cible (ex. une leçon) :

1. Le contenu doit être `published`, ainsi que tous ses parents. Sinon il est invisible.
2. Les règles sont évaluées **du parent vers l'enfant** : cours, puis chapitre, puis leçon.
3. À chaque niveau :
   - aucune règle → le niveau **hérite** de la décision du parent ;
   - au moins une règle `deny` qui correspond → **refusé** (`deny` l'emporte toujours) ;
   - au moins une règle `allow` qui correspond → **autorisé** ;
   - des règles `allow` existent mais aucune ne correspond → **refusé**.
4. Un cours sans aucune règle est **refusé par défaut**. Il faut une règle explicite, `everyone` au minimum. Ce choix évite de publier par erreur un contenu sensible à tout le monde. Le back-office propose `everyone` comme règle initiale à la création d'un cours.
5. Un enfant ne peut pas élargir l'accès au-delà de son parent. On ne peut pas voir une leçon si on n'a pas accès à son cours.

L'évaluation est une fonction pure de `elearning-core` :

```ts
canAccess(learner: Learner, path: ContentPath, rules: AccessRule[]): AccessDecision
```

Elle est testée exhaustivement (tests de propriétés).

## Application

- **Côté serveur, toujours.** Chaque handler apprenant filtre les résultats avec `canAccess`. Le client ne reçoit jamais un contenu auquel il n'a pas accès, même masqué.
- **Les URLs vidéo** sont signées par apprenant et ne sont émises qu'après vérification de l'accès.
- **La progression** ne compte que les leçons accessibles (voir [03 — Modèle de données](03-modele-de-donnees.md#règles-de-calcul)).
- **Changement de rôle** : l'accès est réévalué à chaque requête, puisque l'identité n'est jamais mise en cache. La progression acquise est conservée mais n'est plus affichée pour les contenus devenus inaccessibles.
- **Multi-tenant** : toutes les requêtes sont filtrées par `tenant_id`. Les contenus avec `tenant_id null` peuvent être déclarés **partagés** entre tenants (option `sharedCatalog`), pour un catalogue commun à toutes les sociétés d'un ERP.

## Inscription et assignation

L'accès (pouvoir voir un cours) est distinct de l'inscription (le cours est dans « mes formations » avec une échéance).

- Un cours peut être en **inscription libre** (l'apprenant s'inscrit lui-même) ou **sur assignation**.
- Un admin peut assigner un cours à un apprenant, un rôle ou un grade, avec une date d'échéance éventuelle. L'assignation à un rôle crée les inscriptions à la première visite de l'apprenant (`source = auto`).
- Assigner un cours à quelqu'un qui n'y a pas accès est refusé par le back-office.

## RLS

Par défaut, l'accès aux tables passe uniquement par les handlers serveur, avec une connexion de service. Pour un hôte Supabase qui veut lire directement les tables depuis son propre code (reporting, vues SQL), `elearning-db` fournit une migration **optionnelle** de politiques RLS :

- tables de progression : `learner_id = auth.uid()::text` ;
- tables de contenu : lecture des contenus publiés filtrée par une fonction SQL `elearning.can_access(...)`, qui reprend l'algorithme ci-dessus ;
- écriture réservée au rôle de service.

Cette option suppose que les rôles et grades soient lisibles en SQL (claims JWT). Elle reste opt-in et documentée comme telle.
