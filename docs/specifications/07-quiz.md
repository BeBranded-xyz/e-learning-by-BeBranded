# 07 — Quiz

## Moteur : SurveyJS Form Library

- **[SurveyJS Form Library](https://surveyjs.io/form-library)** (`survey-core` + `survey-react-ui`) sous licence **MIT** sert au **rendu** des quiz côté apprenant.
- La définition d'un quiz est un **JSON SurveyJS standard**, stocké dans `quizzes.definition`.
- **SurveyJS Creator** (l'éditeur visuel) est sous **licence commerciale** et n'est **pas** une dépendance du module. Le back-office embarque **notre propre éditeur de quiz**, volontairement limité aux types de questions supportés, qui produit du JSON SurveyJS. Un hôte qui possède une licence Creator pourra la brancher via un slot (hors v1).

## Types de questions supportés (v1)

| Type | SurveyJS | Notation |
|------|----------|----------|
| Choix unique | `radiogroup` | 1 si correct, sinon 0 |
| Choix multiple | `checkbox` | Configurable : tout-ou-rien (défaut) ou partiel (bonnes réponses cochées − mauvaises cochées, borné à 0) |
| Vrai / faux | `boolean` | 1 / 0 |
| Réponse courte | `text` | Comparaison normalisée (casse, espaces, accents) avec une liste de réponses acceptées |
| Remise en ordre | `ranking` | Tout-ou-rien |
| Association | `matrix` | Partiel par ligne |

Chaque question peut avoir un **poids** (`score`, défaut 1) et une **explication** affichée lors de la correction.

## Sécurité : jamais de bonnes réponses côté client

Une définition SurveyJS contient normalement `correctAnswer`. Si on l'envoyait au navigateur, n'importe qui pourrait lire les réponses dans l'onglet réseau. Le module applique donc les règles suivantes :

1. `GET /quizzes/:id` renvoie une **définition expurgée** : `correctAnswer`, les réponses acceptées, les explications et les poids sont retirés par `redactQuiz()` (core). Le mode « vérification immédiate » de SurveyJS est désactivé.
2. `POST /quizzes/:id/attempts` envoie **les réponses brutes**.
3. Le serveur note avec la **définition complète** (`scoreQuiz()`, fonction pure de core) et calcule `score = points obtenus / points possibles`.
4. `passed = score ≥ passing_score`.
5. La réponse contient le score et `passed`, et les corrections (bonne réponse, explication) seulement si `show_correction` l'autorise : `after_attempt` ou `after_pass`.

## Tentatives

- **`max_attempts`** : au-delà, `POST /attempts` renvoie `409 ATTEMPTS_EXHAUSTED`. Un admin peut accorder des tentatives supplémentaires.
- **`cooldown_minutes`** : délai minimal entre deux tentatives (`429 COOLDOWN` avec la date de disponibilité).
- **Mélange** des questions et des choix (`shuffle_questions`) : il est fait côté serveur à l'ouverture de la tentative, avec une graine enregistrée, pour que la correction corresponde à ce que l'apprenant a vu.
- **Tentative ouverte** : `started_at` est enregistré à l'ouverture. Une limite de temps optionnelle (`time_limit_minutes`) peut être vérifiée côté serveur à la soumission.
- Le **meilleur score** est retenu pour la progression. Toutes les tentatives sont conservées pour le reporting.
- Une fois le quiz réussi, l'apprenant peut le repasser pour s'entraîner sans perdre son statut `completed`.

## Évolution d'un quiz

- `quiz_attempts.quiz_version` stocke un hash de la définition utilisée. Les scores historiques ne sont jamais recalculés.
- Modifier un quiz publié affiche un avertissement dans le back-office (« N apprenants ont déjà passé ce quiz »).

## Reporting

- Taux de réussite par quiz, score moyen, nombre moyen de tentatives.
- **Analyse par question** : pourcentage de bonnes réponses, ce qui permet de repérer les questions ambiguës ou un contenu de cours insuffisant.
- Export CSV.
