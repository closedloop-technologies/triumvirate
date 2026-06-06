# Triumvirate Roadmap Prework

Status: Pending human, prework completed

## Purpose

Convert the open roadmap features into implementation-ready packets without
claiming they are shipped. Triumvirate already reviews code across OpenAI,
Claude, and Gemini; this prework defines the next safe slices for configuration,
workflow control, provider expansion, issue integrations, review history, and
collaboration.

## Feature Packets

| Roadmap Item | Status | First Safe Slice | Required Validation |
| --- | --- | --- | --- |
| Configuration file support | Pending human, prework completed | Parse `.triumviraterc` and `~/.triumvirate/config.json` into existing CLI options without changing default behavior. | Unit tests for precedence: CLI flags, repo config, user config, env defaults. |
| Interactive mode | Pending human, prework completed | Add a dry-run prompt flow that prints the equivalent command before execution. | Fixture-based terminal transcript test with no API calls. |
| Plugin system | Pending human, prework completed | Define a read-only plugin manifest and blocked side-effect list before loading plugin code. | Manifest schema validation and unsafe plugin rejection test. |
| Issue tracker integration | Pending human, prework completed | Export review findings to GitHub Issues/Jira-shaped JSON before creating any remote issue. | Snapshot test for exported issue payloads and human approval gate. |
| Repomix token-limit reruns | Pending human, prework completed | Record a deterministic pack/repack plan before invoking a second LLM pass. | Fixture test that proves rerun inputs are smaller and traceable. |
| Smarter file filtering | Pending human, prework completed | Add a scoring report that explains why files are included or excluded. | Unit tests for focus, changed files, ignore rules, and large-file handling. |
| Incremental reviews | Pending human, prework completed | Store an immutable baseline fingerprint and review only changed hunks in dry-run mode. | Baseline/changelog fixture test and fallback-to-full-review gate. |
| Custom prompt templates | Pending human, prework completed | Load repo-local templates from an allowlisted path and render with explicit variables. | Template injection rejection test and rendered prompt snapshot. |
| Additional LLM providers | Pending human, prework completed | Add provider capability descriptors before adding Mistral, Cohere, or local runtime calls. | Provider contract tests for streaming, JSON mode, cost metadata, and missing-key errors. |
| Web UI | Pending human, prework completed | Generate static report viewer from existing findings JSON. | HTML snapshot and no-server artifact test. |
| Review history and trends | Pending human, prework completed | Append local JSONL history entries after each completed review. | Redaction, schema, and retention tests. |
| Team collaboration | Pending human, prework completed | Export a review handoff bundle with comments, findings, cost, and next actions. | Bundle schema validation and no-secrets scan. |

## Human-Pending Boundaries

- No provider expansion is verified until live or mocked provider contract tests
  cover model selection, failure modes, costs, and API-key absence.
- No issue tracker integration may create GitHub/Jira side effects until a human
  approves the generated payload and target repository/project.
- No plugin execution is allowed until plugin manifests, sandbox rules, and
  blocked side effects are validated.
- No web UI launch claim is allowed from a static report viewer alone.
- No team-collaboration claim is allowed until a real handoff bundle is reviewed
  by another human or agent.

## Validation Commands

```bash
node scripts/validate-roadmap-prework.js
node scripts/validate-issue-export-prework.js
npm test
npm run type-check
```

The roadmap validator is dependency-free. The test and type-check commands
remain the broader implementation health checks.

## Proof Statement Draft

Used the Triumvirate roadmap-prework skill to turn planned CLI, provider,
workflow, issue-tracker, web UI, history, and collaboration features into
bounded implementation packets with validation, side-effect gates, and human
review boundaries before claiming any of the roadmap features are shipped.

## Implemented Local Packets

- Issue tracker export prework:
  `docs/issue-tracker-export-prework.md`, `src/utils/issue-export.ts`, and
  `test/issue-export.test.ts` create local GitHub/Jira-shaped JSON only.
  Remote issue creation remains blocked until human approval and a future
  side-effect packet exist.
