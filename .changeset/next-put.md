---
"@bebranded/elearning-next": patch
---

`createElearningRouteHandler` also returns `PUT`, so `PUT /v1/admin/lessons/:id/quiz` (saving a quiz) reaches the module in Next.js hosts instead of answering 405. Export it from your route: `export const { GET, POST, PATCH, PUT, DELETE } = createElearningRouteHandler(elearning);`.
