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
3. The browser sends the file **directly to the provider**. The file never goes through the host's server. Phase 2 uses Cloudflare's direct creator upload (one `multipart/form-data` POST, up to 200 MB), created with `requireSignedURLs` so the video is private. Resumable tus uploads for larger files come with the back-office (phase 4).
4. The `POST /webhooks/video` webhook moves the asset to `processing`, then `ready`, and records `duration_seconds`. Webhooks with an invalid signature are rejected.
5. The lesson cannot be published until the asset is `ready`.

## Watched-segment tracking

### Client side (`<VideoPlayer>`)

- `<VideoPlayer>` uses the browser's native controls (keyboard-operable and labelled by the browser). It loads hls.js on demand, only where the browser cannot play HLS natively. It keeps the first signed URL for the whole session: each lesson fetch signs a new one, and switching would restart playback.
- The player keeps a list of **intervals actually played**. An interval opens on `play` and extends on each `timeupdate` while playback is continuous. It closes on `pause`, `seeking`, `ended` or a jump of more than 2 s.
- Intervals crossed during `seeking` do not count.
- **Heartbeat** every 15 s of playback, plus on pause, on end, on tab visibility change and on `pagehide`. The page-exit heartbeat uses `fetch` with `keepalive`, not `navigator.sendBeacon`: a beacon cannot send an `application/json` body, which the API requires against CSRF. Heartbeats are sent one at a time in `seq` order (the server drops a `seq` lower than one it already has); only the page-exit heartbeat skips the queue. A failed heartbeat's intervals go out with the next one:

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

- Per-lesson options (`lessons.settings`, `videoLessonSettingsSchema` in `elearning-core`):
  - `allowSeeking` (default `true`): `false` forbids moving past the furthest position already watched. Seeking backwards stays free. The server enforces it too.
  - `maxPlaybackRate` (1 to 4, default 2): highest speed offered.
  - `pauseWhenHidden` (default `false`): pauses the video when the tab is not visible.
  - `completionThreshold` (0.5 to 1, default 0.95): required coverage, to tolerate end credits and occasional lost heartbeats.

### Server side (source of truth)

The player calls `POST /lessons/:id/start` when the lesson opens: the first heartbeat is measured from that moment. A heartbeat for a lesson that was not started starts it, and its playback is not credited.

On each heartbeat, the server:

1. Checks access to the lesson.
2. Ignores `seq` values already received for the session (idempotency, beacon replays).
3. Clamps intervals to `[0, duration_seconds]`. The duration must come from the provider. An interval reaching more than 1 s outside the video is suspicious.
4. With `allowSeeking = false`, drops intervals that start more than 2 s past the furthest point watched.
5. **Plausibility check**: the total length of the new intervals cannot exceed `elapsed × maxPlaybackRate × 1.1`. `elapsed` is the time since the learner's last accepted heartbeat for the lesson, across all player sessions (since the lesson start for the first one), capped at 60 s. Nobody can claim 10 minutes of video in 15 seconds, by opening several sessions, or after leaving the page idle for an hour. An implausible heartbeat is **truncated** to its earliest intervals that the elapsed time allows. The playback rate reported by the client is ignored.
6. Increments `suspicious_events` once for a heartbeat that was clamped, had intervals dropped, or was truncated.
7. Merges the intervals into `watched_ranges` (sorted union) and recomputes `watched_seconds` and `coverage`.
8. When `coverage ≥ completionThreshold`, sets the lesson to `completed` and emits `lesson.completed`. This transition is final.
9. Updates `last_position`, kept inside the video, to resume playback.

Interval merging and steps 3 to 9 are pure functions in `elearning-core` (`mergeRanges`, `applyHeartbeat`), with property-based tests: the union is idempotent and commutative, coverage is always between 0 and 1, and a sequence of heartbeats never credits more playback than the elapsed time allows.

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
