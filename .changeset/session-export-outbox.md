---
"@bebranded/elearning-core": minor
"@bebranded/elearning-react": minor
"@bebranded/elearning-db": minor
"@bebranded/elearning-server": minor
"@bebranded/elearning-export": patch
"@bebranded/elearning-admin": patch
---

Isolate React query caches by API base and the host's optional sessionKey. Hosts
that switch learner or tenant in place must change sessionKey at the same time.

Propagate export cancellation into image loading and PDF adapters, close browser
resources on abort, and retain concurrency slots until actual work settles.
FileStorage.read accepts an optional AbortSignal through its options argument.

Claim outbox events immediately before each delivery, bound handlers to 30 seconds
and pass a cancellation signal in their context. Storage adapters must now pass
{id, attempts} to markEventDelivered/markEventFailed and fence writes against the
claim attempt. Delivery remains at least once; handlers must deduplicate by event id.

Initialize native lesson and quiz editor menus with the provider's English or
French locale.
