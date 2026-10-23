---
"@bebranded/elearning-core": patch
"@bebranded/elearning-db": patch
---

Fix: honest playback at the lesson's top speed was partly refused when heartbeats arrived a few milliseconds apart (the 15 s tick, then pause and end). The time a heartbeat does not use now carries over to the next one, still capped at 60 s. `VideoProgressState.lastHeartbeatAt` is renamed `budgetBaselineAt`.
