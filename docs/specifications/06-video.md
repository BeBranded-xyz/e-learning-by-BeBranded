# 06 — Vidéo et vérification du visionnage

Objectif : quand le module dit qu'une vidéo a été vue, c'est qu'elle l'a été. Sans un dispositif invasif, l'apprenant reste techniquement capable de laisser tourner la vidéo sans la regarder. Mais il ne doit pas pouvoir **sauter** le contenu ou **falsifier** la complétion depuis le client.

## Fournisseurs

| | Cloudflare Stream (défaut) | Mux | Bunny Stream |
|---|---|---|---|
| URLs signées | Oui (JWT signé par clé) | Oui | Oui (token auth) |
| Streaming adaptatif HLS/DASH | Oui | Oui | Oui |
| Upload direct navigateur | Oui (tus) | Oui | Oui |
| Webhooks « prêt » | Oui | Oui | Oui |
| Sous-titres | Oui, avec génération auto | Oui | Oui |
| Facturation | Minutes stockées + minutes livrées | Encodage + stockage + livraison | Stockage + bande passante |

Tous sont accessibles via `VideoProvider` (voir [04 — Intégration](04-integration.md#3-vidéo--videoprovider)). Le lecteur côté client est **commun** : un lecteur HLS (hls.js ou `<video>` natif sur Safari) piloté par nos composants. On n'utilise pas d'iframe fournisseur, car il faut un accès fiable aux événements de lecture.

## Upload (back-office)

1. L'admin choisit un fichier. Le back-office appelle `POST /admin/videos/uploads`.
2. Le serveur demande au fournisseur une URL d'upload direct et crée `video_assets` avec le statut `uploading`.
3. Le navigateur envoie le fichier **directement au fournisseur** (upload résumable tus). Le fichier ne passe jamais par le serveur de l'hôte.
4. Le webhook `POST /webhooks/video` fait passer l'asset à `processing`, puis à `ready`, et enregistre `duration_seconds`.
5. La leçon ne peut pas être publiée tant que l'asset n'est pas `ready`.

## Suivi des segments regardés

### Côté client (`<VideoPlayer>`)

- Le lecteur maintient une liste d'**intervalles réellement joués** : un intervalle s'ouvre au `play` et s'étend à chaque `timeupdate` si la progression est continue. Il se ferme sur `pause`, `seeking`, `ended` ou un saut de plus de 2 s.
- Les intervalles parcourus pendant un `seeking` ne comptent pas.
- **Heartbeat** toutes les 15 s de lecture, et à la pause, à la fin, au changement de visibilité de l'onglet et à `pagehide` (via `navigator.sendBeacon`) :

```json
POST /lessons/:id/video-progress
{
  "sessionId": "c0a8…",          // une session par chargement du lecteur
  "seq": 7,                       // numéro de séquence monotone
  "ranges": [[120.0, 134.9]],     // nouveaux intervalles depuis le dernier heartbeat
  "position": 134.9,
  "playbackRate": 1.25
}
```

- Options configurables par leçon (`lessons.settings`) :
  - `allowSeeking` : `false` interdit d'avancer au-delà de la position maximale déjà regardée. Le retour en arrière reste libre.
  - `maxPlaybackRate` : vitesse maximale proposée (défaut 2).
  - `pauseWhenHidden` : met la vidéo en pause quand l'onglet n'est pas visible.
  - `completionThreshold` : couverture requise (défaut 0,95, pour tolérer les génériques et les petites pertes de heartbeat).

### Côté serveur (fait foi)

À chaque heartbeat, le serveur :

1. Vérifie l'accès à la leçon.
2. Rejette les intervalles hors de `[0, duration_seconds]`, ce qui suppose que la durée vienne du fournisseur.
3. **Contrôle de plausibilité** : la durée totale des nouveaux intervalles ne peut pas dépasser `(maintenant − dernier heartbeat de la session) × maxPlaybackRate × 1,1`. On ne peut pas déclarer avoir regardé 10 min de vidéo en 15 s. Un heartbeat non plausible est **tronqué** à ce que le temps écoulé autorise, et `suspicious_events` est incrémenté.
4. Ignore les `seq` déjà reçus (idempotence, rejeu de beacon).
5. Fusionne les intervalles dans `watched_ranges` (union triée) et recalcule `watched_seconds` et `coverage`.
6. Passe la leçon à `completed` et émet `lesson.completed` quand `coverage ≥ completionThreshold`. La transition est définitive.
7. Met à jour `last_position` pour la reprise de lecture.

La fusion d'intervalles et le contrôle de plausibilité sont des fonctions pures de `elearning-core`, avec des tests de propriétés : l'union est idempotente et commutative, et la couverture est toujours ≤ 1.

### Ce que ce dispositif garantit, et ce qu'il ne garantit pas

| Tentative | Résultat |
|-----------|----------|
| Appeler l'API pour déclarer toute la vidéo vue | Bloqué : plausibilité temporelle |
| Avancer jusqu'à la fin | Bloqué : les zones sautées ne comptent pas (et le seek est interdit si `allowSeeking = false`) |
| Lire en ×16 via la console | Bloqué : plafond `maxPlaybackRate` côté serveur |
| Récupérer l'URL de la vidéo pour la partager | Limité : URL signée, nominative, à courte durée de vie (TTL ≈ durée de la vidéo + marge) |
| Lancer la vidéo et partir | **Non bloqué.** Hors périmètre v1. Une option « question de présence » aléatoire est envisageable plus tard. |

## Accessibilité

- Sous-titres obligatoires recommandés. Le back-office alerte si une vidéo publiée n'a pas de sous-titres.
- Lecteur entièrement utilisable au clavier, avec des contrôles labellisés.
- Transcription textuelle affichable sous la vidéo si elle est fournie.
