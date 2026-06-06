# Triumvirate E2E Harness Prework

Status: Pending human, prework completed

## Purpose

Keep the lightweight `npm run test:e2e` harness useful without requiring live LLM
provider credentials. The script should prove the packaged CLI builds, exposes
the expected command surface, accepts documented options, and cleans its
temporary workspace.

## Completed Prework

| Area | Status | Validation |
| --- | --- | --- |
| Fixture generation | Pending human, prework completed | The generated sample file contains executable behavior and no unfinished-work marker. |
| CLI surface smoke | Pending human, prework completed | The script checks `--help`, `--version`, `review`, `next`, `plan`, and `summarize` help output. |
| Option parsing smoke | Pending human, prework completed | The script checks representative global and `next` options without invoking providers. |
| Workspace hygiene | Pending human, prework completed | The script verifies its temporary e2e directory is removed before reporting success. |

## Human-Pending Boundaries

- This does not replace the credentialed Vitest workflow in `test/e2e.test.ts`.
- This does not prove provider API behavior, model quality, cost accounting, or
  hosted GitHub Action behavior.
- A human should run the credentialed workflow before using this as release
  evidence for provider integrations.

## Validation Commands

```bash
node scripts/validate-e2e-harness-prework.js
npm run test:e2e
```

## Proof Statement Draft

Used the Triumvirate e2e-harness-prework skill to replace an unfinished fixture
marker with a deterministic sample and verify the CLI smoke harness creates,
checks, and removes its temporary workspace before claiming local e2e coverage.
