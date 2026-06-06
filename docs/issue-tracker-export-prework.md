# Issue Tracker Export Prework

Status: Pending human, prework completed

## Purpose

Implement the first roadmap packet for issue tracker integration without
creating GitHub, Jira, or other remote tracker side effects.

The local exporter converts a completed `CodeReviewReport` into GitHub-shaped
and optional Jira-shaped JSON payloads. The payloads are evidence for human
review only. They are not proof that any remote issue was created.

## Local Export Contract

Code:

- `src/utils/issue-export.ts`
- `test/issue-export.test.ts`

Validation:

```bash
npm test -- --run test/issue-export.test.ts
npm run type-check
node scripts/validate-issue-export-prework.js
```

The exported bundle must include:

- `status: Pending human, prework completed`
- `remote_side_effect_allowed: false`
- `human_approval_required: true`
- GitHub issue payloads with title, body, labels, and source metadata
- optional Jira issue payloads with project key, summary, description, issue
  type, labels, and source metadata
- approval gate checklist before any remote create action
- rollback note for mistaken remote creation

## Human Approval Gate

Before any future GitHub or Jira issue is created, a human must record:

- target tracker and repository/project
- exported issue JSON path
- duplicate issue search result
- public-safe wording approval
- no-secrets scan result
- issue labels and assignee/milestone decision
- rollback or close-note text

## Public And Remote Side-Effect Boundary

- Do not call GitHub, Jira, Linear, or any issue tracker API from this packet.
- Do not treat exported JSON as a remote issue.
- Do not publish sensitive review text before the no-secrets review passes.
- Do not claim issue-tracker integration is shipped until a separate
  human-approved remote-create packet exists.

## Decision Log

- 2026-06-06: Implement issue tracker integration as local JSON export first.
  Remote issue creation remains blocked behind human target selection,
  duplicate search, public-safe wording, no-secrets review, and rollback notes.
