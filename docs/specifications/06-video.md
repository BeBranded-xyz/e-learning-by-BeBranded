# 06 — Video and watch verification

Goal: when the module says a video was watched, it was. Short of invasive measures, a learner can still technically let the video play without looking. But they must not be able to **skip** the content or **forge** completion from the client.

## Providers

| | Cloudflare Stream (default) | Mux | Bunny Stream |
|---|---|---|---|
| Signed URLs | Yes (JWT signed with a key) | Yes | Yes (token auth) |
| Adaptive HLS/DASH streaming | Yes | Yes | Yes |
| Direct browser upload | Yes (tus) | Yes | Yes |
| "Ready" webhooks | Yes | Yes | Yes |
| Captions | Yes, with auto-generation | Yes | Yes |
| Billing | Minutes stored + minutes delivered | Encoding + storage + delivery | Storage + bandwidth |

All of them sit behind `VideoProvider` (see [04 — Integration](04-integration.md#3-video-videoprovider)). The client-side player is **shared**: an HLS player (hls.js, or native `<video>` on Safari) driven by our components. We do not use the provider's iframe player, because we need reliable access to playback events.

## Upload (back-office)

1. The admin picks a file. The back-office calls `POST /admin/videos/uploads`.
2. The server asks the provider for a direct upload URL and creates a `video_assets` row with status `uploading`.
3. The browser sends the file **directly to the provider** (resumable tus upload). The file never goes through the host's server.
4. The `POST /webhooks/video` webhook moves the asset to `processing`, then `ready`, and records `duration_seconds`. Webhooks with an invalid signature are rejected.
5. The lesson cannot be published until the asset is `ready`.

## Watched-segment tracking

### Client side (`<VideoPlayer>`)

- The player keeps a list of **intervals actually played**. An interval opens on `play` and extends on each `timeupdate` while playback is continuous. It closes on `pause`, `seeking`, `ended` or a jump of more than 2 s.
- Intervals crossed during `seeking` do not count.
- **Heartbeat** every 15 s of playback, plus on pause, on end, on tab visibility change and on `pagehide` (via `navigator.sendBeacon`):

```json
POST /lessons/:id/video-progress
{
  "sessionId": "c0a8…",          // one session per player load
  "seq": 7,                       // monotonic sequence number
  "ranges": [[120.0, 134.9]],     // new intervals since the last heartbeat
  "position": 134.9,
  "playbackRate": 1.25
}
```

- Per-lesson options (`lessons.settings`):
  - `allowSeeking`: `false` forbids moving past the furthest position already watched. Seeking backwards stays free.
  - `maxPlaybackRate`: highest speed offered (default 2).
  - `pauseWhenHidden`: pauses the video when the tab is not visible.
  - `completionThreshold`: required coverage (default 0.95, to tolerate end credits and occasional lost heartbeats).

### Server side (source of truth)

On each heartbeat, the server:

1. Checks access to the lesson.
2. Rejects intervals outside `[0, duration_seconds]`. The duration must come from the provider.
3. **Plausibility check**: the total length of the new intervals cannot exceed `(now − last heartbeat of the session) × maxPlaybackRate × 1.1`. Nobody can claim 10 minutes of video in 15 seconds. An implausible heartbeat is **truncated** to what the elapsed time allows, and `suspicious_events` is incremented.
4. Ignores `seq` values already received (idempotency, beacon replays).
5. Merges the intervals into `watched_ranges` (sorted union) and recomputes `watched_seconds` and `coverage`.
6. When `coverage ≥ completionThreshold`, sets the lesson to `completed` and emits `lesson.completed`. This transition is final.
7. Updates `last_position` to resume playback.

Interval merging and the plausibility check are pure functions in `elearning-core`, with property-based tests: the union is idempotent and commutative, and coverage is always ≤ 1.

### What this does and does not guarantee

| Attempt | Outcome |
|---------|---------|
| Calling the API to declare the whole video watched | Blocked: time plausibility check |
| Seeking to the end | Blocked: skipped parts do not count (and seeking is forbidden when `allowSeeking = false`) |
| Playing at ×16 from the console | Blocked: server-side `maxPlaybackRate` cap |
| Grabbing the video URL to share it | Limited: signed, per-learner, short-lived URL (TTL ≈ video duration + margin) |
| Starting the video and walking away | **Not blocked.** Out of scope for v1. A random "are you still there?" check could be added later. |

## Accessibility

- Captions are strongly recommended. The back-office warns when a published video has none.
- The player is fully keyboard-operable, with labelled controls.
- A text transcript can be shown below the video when provided.
