# Triumvirate Decisions

## 2026-06-06: Roadmap Items Become Prework Packets First

Decision: Treat configuration files, interactive mode, plugins, issue tracker
integration, review workflow controls, provider expansion, web UI, history, and
collaboration as preworked but not shipped.

Reasoning: The roadmap mixes small local features with features that can create
external side effects or new execution surfaces. A prework packet lets future
agents implement each feature with validation, rollback, and human approval
boundaries instead of turning on broad behavior at once.

Implications:

- Issue tracker integrations must start with JSON export and human approval
  before creating remote issues.
- Plugin support must start with manifest validation and blocked side-effect
  rules before executing plugin code.
- Provider expansion must start with provider capability descriptors and
  contract tests before making live calls.
- Web UI and collaboration work must start with static/local artifacts before
  launch or team-workflow claims.

## 2026-06-06: Issue Tracker Export Is Local First

Decision: Implement issue tracker integration as GitHub/Jira-shaped JSON export
before any remote create action.

Reasoning: Review findings may contain sensitive project details, duplicate
issues, or wording that should not become public automatically. A local export
gives a human approval artifact without mutating GitHub, Jira, or another
tracker.

Implications:

- `src/utils/issue-export.ts` may shape issue payloads and approval gates.
- Remote issue creation remains blocked until a future packet records target
  tracker, duplicate search, public-safe wording, no-secrets scan, and rollback
  notes.
- Exported JSON is evidence for review, not proof that issue tracker
  integration is shipped.
