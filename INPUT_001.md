Thought for 4 seconds

### Hunch Statement — *Why Triumvirate Exists*

Modern repos already run unit tests, linters, and type-checkers on every commit, yet **critical architectural, security, and design flaws still slip through**. Traditional static-analysis tools work at the *syntax* or *file* level; they rarely see the *whole codebase*—let alone your docs, configuration, and historical context—in one shot.

> **Hypothesis:** If we feed the entire repository (or an auto-compressed Repomix snapshot) into today’s largest-context LLMs (GPT-4o 128k, Claude-Sonnet 200k, Gemini 2.5 2M), those models can perform a holistic, cross-file review that surfaces subtle bugs, leaky abstractions, security gaps, and architectural drift that conventional linters miss.

Triumvirate operationalizes this by:

1. **Multi-Model Redundancy** – Runs the review through *three* top-tier LLMs, then highlights consensus findings for higher signal.
2. **Context-Window Maximization** – Repomix packs as much of the repo as fits; anything trimmed is summarized so nothing is truly lost.
3. **Actionable Output** – Findings are auto-prioritized and decomposed into tasks (`tri plan` → `tri next`) that slot straight into your sprint board.
4. **CI-Friendly** – Ships as a CLI and GitHub Action, so this “catch-all static analysis” becomes just another gate in your pipeline.

**Why now?** Context windows have exploded (200k-2M tokens), making full-repo reasoning practical for the first time. Marrying that capability with automated task generation closes the loop from *insight* to *actionable work*, something no existing static toolchain offers.
