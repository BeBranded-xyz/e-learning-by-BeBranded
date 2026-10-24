---
"@bebranded/elearning-core": minor
"@bebranded/elearning-server": minor
"@bebranded/elearning-admin": minor
"@bebranded/elearning-react": minor
---

Add a course authoring workspace with persistent navigation, chapter and lesson
editing, completion controls, access guidance and read-only draft previews.

Course completion rules now accept percentage thresholds. Upgrade server and
clients together before storing this rule; older versions cannot parse it.
Before downgrading, restore affected rules to all_required_lessons or restore the
pre-upgrade backup. Existing all_required_lessons courses retain their behavior.
