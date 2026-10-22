---
description: graphify knowledge graph context
paths:
  - "graphify-out/**"
---

Apply this rule only if the project uses graphify (see the "Active rule modules"
section of `PROJECT.md`). When enabled, the knowledge graph lives at `graphify-out/`.

- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current

## Testing

- After a rebuild, verify that the report reflects changed source files and
  that the wiki index links to existing generated pages.
- Report rebuild failures explicitly; never present an outdated graph as current.

## Checklist when using the knowledge graph

- [ ] Graphify is enabled for this project
- [ ] Report and available wiki read before relying on graph context
- [ ] Graph rebuilt after source changes and generated references checked
