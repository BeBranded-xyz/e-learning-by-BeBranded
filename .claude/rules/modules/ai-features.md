---
description: LLM-powered product features - prompts as code, model config, provider wrapper, structured outputs, evals, cost, safety, privacy, RAG, agents. Apply to prompt, LLM, AI, and agent code.
paths:
  - "**/prompts/**"
  - "**/llm/**"
  - "**/ai/**"
  - "**/agents/**"
---

# AI Features

## When this applies

Apply to every file matching the globs, and whenever `PROJECT.md` declares that
the product calls an LLM (chat, extraction, classification, generation, RAG,
agents). The provider, model ids, regions, data-retention settings, and
per-feature budgets live in `PROJECT.md`. This rule covers the product calling
models; it is not about using an AI assistant to write code. Provider wrappers,
rate limits, and backoff follow `modules/integrations.mdc`; tracing follows
`modules/observability.mdc`; PII rules follow `core/security.mdc`.

## Principles

- **Prompts are code**: versioned, reviewed, tested, and released like code.
- **Model output is untrusted input**: validate it at the boundary like any
  external payload.
- **Every call is measured**: tokens, latency, cost, and quality, per prompt version.
- **Untrusted content never becomes instructions.**
- **Nothing irreversible happens without a human or a hard allowlist.**

## Rules

### Prompts as code

- **One prompt per file** under `prompts/` (or the directory in `PROJECT.md`),
  never an inline string in business logic.
- **Templated with typed variables**; rendering fails on a missing or extra
  variable. No string concatenation of user content into the template body.
- **Each prompt has a `name` and a `version`**; changing the text bumps the
  version, and the version is sent with every call and trace.
- **System and user roles are separate fields**; untrusted content only ever
  goes in a user or tool message, inside explicit delimiters.

```ts
export const summarizeTicket = definePrompt({
  name: "support.summarize_ticket",
  version: 3,
  system: readPrompt("support/summarize_ticket.system.md"),
  input: z.object({ ticket: z.string().max(20_000), locale: z.string() }),
  output: z.object({ summary: z.string(), priority: z.enum(["low", "normal", "high"]) }),
  user: ({ ticket, locale }) =>
    `Locale: ${locale}\n<untrusted_ticket>\n${ticket}\n</untrusted_ticket>`,
});
```

### Model configuration

- **One config file declares provider, model, temperature, max tokens, timeout,
  and fallback model** as defaults, with a per-feature override block. Nothing
  else in the codebase names a model id.
- **Model ids are exact, dated versions**; never an alias that moves.
- **A model or parameter change is a PR** that runs the eval suite (below).

### Provider abstraction

- **One typed wrapper module** exposes `complete`, `stream`, `embed`, and
  `structured`; business code never imports a provider SDK
  (`modules/integrations.mdc`).
- **The wrapper owns** retries with backoff on 429/5xx, timeouts, token
  counting, cost computation, tracing, redaction, region, and fallback.
- **A provider swap is a config change**; the wrapper interface never leaks
  provider-specific fields.

### Structured outputs

- **Use JSON schema or tool-call outputs** for anything a program consumes;
  never regex-parse free text.
- **Validate every output with the prompt's output schema**; on failure, retry
  once with the validation error appended, then raise a typed error with the
  reason code `llm_output_invalid`.
- **Enums over free strings** for anything that drives a branch.
- **Free-text output is display-only**, rendered as text, never as HTML.

### Evaluation

- **A golden dataset per feature** (`evals/<feature>/cases.jsonl`): input,
  expected output or rubric, tags. Minimum 30 cases; grows with every bug.
- **Offline evals run in CI** on any change to a prompt, the model config, or
  the wrapper; results are posted on the PR.
- **The regression threshold is explicit** per feature in `PROJECT.md` (for
  example: a score drop over 2 points or any failing must-pass case blocks merge).
- **LLM-as-judge is allowed** for rubric scoring only while a human-reviewed
  sample (at least 10% of cases, reviewed quarterly) agrees with the judge.
- **Production samples feed the dataset** after redaction and review.

### Cost and latency

- **Token budget per call** (input and output) declared in the prompt config;
  exceeding it is a typed error, never silent truncation.
- **Cache** identical prompt-plus-input pairs and use provider prompt caching
  for stable system prompts.
- **Stream** anything shown to a user that takes more than 2 seconds.
- **Timeouts** per call, shorter than the calling request's timeout.
- **Fall back to a smaller model** on timeout or provider outage where the
  feature tolerates it; log the fallback.
- **Batch** offline workloads; never call a model per row in a loop when a
  batch API exists.

### Safety

- **Untrusted content is clearly delimited** (tags as above) and the system
  prompt states that content inside delimiters is data, not instructions.
- **No tool execution from untrusted instructions**: a tool call is honored
  only if the tool is on the feature's allowlist and its arguments pass the
  tool's schema; content fetched by a tool cannot add tools.
- **Output filtering** before display or action: strip markup, block secret
  and PII patterns, enforce length.
- **Human confirmation for irreversible actions** (send, pay, delete, publish):
  the model proposes, a person confirms, the code executes.
- **Rate-limit per user and per feature**; a model call is a paid operation.

### Privacy

- **Minimize before sending**: redact or pseudonymize PII the task does not
  need; send ids and derived fields instead of raw records.
- **Provider data-retention and training opt-out settings are documented in
  `PROJECT.md`**, with the date they were verified.
- **EU region endpoints where `PROJECT.md` requires it**; the wrapper enforces
  the region, not the caller.
- **Users are told** which features use a model and can opt out where required.

### Observability

- **Trace every call** with prompt name and version, model id, input and
  output tokens, latency, cost, cache hit, fallback used, and validation result.
- **No raw prompts or outputs containing PII in traces**; store redacted
  versions or a hash plus a reference to a retention-controlled store.
- **Dashboards per feature**: cost per day, p95 latency, validation failure
  rate, eval score over time. Alert on cost anomalies and failure rate.

### RAG

- **The chunking strategy is documented** (size, overlap, splitter) next to the
  indexing code and in `PROJECT.md`.
- **Every answer returns citations** (source id, chunk id, score); the UI shows them.
- **Freshness is measured**: index lag from source update is a metric with an
  alert; re-index on source change, not on a guess.
- **Retrieved content is untrusted** and delimited like user content.
- **Access control applies at retrieval**: filter by the caller's permissions
  before ranking, never after.

### Agents

- **Bounded loops**: a hard step limit, a token budget, and a wall-clock
  deadline per run; hitting any of them ends the run with a typed error.
- **Tool schemas validated** on definition and on every call; tools are pure
  functions with typed inputs and outputs, tested in isolation.
- **Sandboxed execution** for any code or shell tool: no network by default,
  no host filesystem, resource limits.
- **Every step is traced and persisted** so a run can be replayed and audited.
- **Agents never hold credentials**; tools call wrappers that hold them.

### Tooling

Language toolchain per `languages/*.mdc`. Schema library for prompt input and
output (Zod, Pydantic, or equivalent). Eval runner (`promptfoo`, Braintrust,
LangSmith, or a repo script) invoked by `pnpm eval` / `make eval`. Prompt files
are linted for undeclared variables. The project's single check command
(`make check` / `pnpm check`) runs unit and schema tests; `eval` runs in CI on
prompt, config, or wrapper changes.

## Testing

- **Unit tests with recorded fixtures**: the wrapper is mocked with recorded
  provider responses; no live calls in unit tests.
- **Schema tests**: every prompt's input and output schema rejects malformed
  data; the validation failure path raises the typed error.
- **Eval runs**: golden dataset per feature, regression threshold enforced in
  CI, human-reviewed judge sample.
- **Adversarial suite**: prompt injection cases (instruction override, tool
  invocation from content, data exfiltration, delimiter escape) must not change
  behavior; grows with every incident.
- **Contract tests** of the wrapper against the live provider in a scheduled
  workflow (not on every PR) with a sandbox key.
- **Load tests** on the feature's rate limits: graceful 429 handling, fallback,
  and cost cap under burst.
- **Determinism**: tests run with `temperature: 0` and a fixed seed where the
  provider supports it; non-deterministic assertions use rubrics, not equality.
- **Agent tests**: step limit, deadline, and budget exhaustion each end the run
  cleanly; sandbox escape attempts fail.

## Checklist when touching AI feature code

- [ ] Prompt in its own file, versioned, typed variables, no inline strings
- [ ] Model and parameters from the single config; exact model id
- [ ] All calls go through the typed wrapper; no provider SDK in business code
- [ ] Output is structured and schema-validated; no regex on free text
- [ ] Golden dataset updated; eval run passes the threshold
- [ ] Token budget, timeout, caching, streaming, and fallback declared
- [ ] Untrusted content delimited; tool allowlist enforced; irreversible actions confirmed
- [ ] PII minimized before sending; retention and region per `PROJECT.md`
- [ ] Trace carries prompt version, model, tokens, latency, cost; no raw PII
- [ ] RAG: citations returned, permissions filtered at retrieval
- [ ] Agents: step limit, budget, deadline, sandboxed tools
- [ ] Adversarial and schema tests added for the change
