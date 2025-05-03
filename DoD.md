# ✅ Definition of Done (DoD) for Triumvirate

This file defines the necessary and sufficient criteria for Triumvirate to be considered complete, maintainable, and useful for both personal workflows and community adoption.

---

## 🧠 Core Functionality

* [ ] `tri review` performs successful multi-model LLM reviews from the CLI, with configurable models and output format.
* [ ] `tri summarize` generates clean, structured markdown from raw LLM responses.
* [ ] `tri plan` decomposes a review into task objects with IDs, priorities, and dependencies.
* [ ] `tri next` surfaces the next unblocked, high-priority task from the plan.

---

## 🔄 Usability & Developer Experience

* [ ] Clear CLI help via `tri --help` and subcommand-specific help.
* [ ] Quiet, verbose, and arcade-style output modes.
* [ ] Output files (JSON/Markdown) saved to `.justbuild/` or specified path with timestamp.

---

## 📦 Portability

* [ ] CLI runs on Node.js 20+ without runtime errors.
* [ ] Installable via `npm install -g @justbuild/triumvirate`.
* [ ] Reads credentials from `.env` or environment variables; degrades gracefully if missing.

---

## 🧪 Test Coverage

* [ ] Unit tests exist for:

  * [ ] LLM provider wrappers
  * [ ] Plan generation logic
  * [ ] Task selection (`tri next`)
* [ ] Integration test for end-to-end: `review → plan → next`.
* [ ] `test/test-provider.ts` validates real LLM calls (manual opt-in).

---

## 📖 Documentation & Onboarding

* [ ] `README.md` includes installation, usage, CLI reference, and badges.
* [ ] `USAGE.md` or `examples/` folder with at least 3 sample workflows.
* [ ] `.env.example` fully describes necessary API keys and formats.

---

## 🔐 Security & Stability

* [ ] All user input is validated and sanitized before use.
* [ ] All async functions wrapped in try/catch or error boundary logic.
* [ ] No API keys or secrets are printed or saved unencrypted.

---

## 🔁 Community & Contribution Readiness

* [ ] `CONTRIBUTING.md` explains how to:

  * [ ] Run in development mode
  * [ ] Submit issues or PRs
  * [ ] Add new models or prompt types
* [ ] GitHub Actions CI:

  * [ ] Runs lint, type-check, and tests on PRs and pushes
* [ ] Modular file layout: easy to fork, extend, or debug.

---

## 🏷️ Viral Growth Hooks *(Optional)*

* [ ] Post-review badge can be optionally embedded in README.md.
* [ ] `tri next` supports optional `--branch` mode to create git branches per task.
* [ ] Summary supports markdown suitable for GitHub PR comments.

## Optional Features

* Support for all of the following LLM providers
  * openai
  * anthropic
  * azure
  * azure_ai
  * vertex_ai-language-models
  * vertex_ai-anthropic_models
  * vertex_ai-mistral_models
  * vertex_ai-ai21_models
  * vertex_ai-llama_models
  * mistral
  * xai
  * deepinfra
  * gemini
  * cohere_chat
  * openrouter
  * ai21
  * bedrock
  * bedrock_converse
  * groq
  * cerebras
  * perplexity
  * fireworks_ai
  * databricks
  * sambanova
  * snowflake

* Global config (like oco - to select the models, API keys, define preferences, etc.)
* CI/CD deployment script


CLI should
 * Allow specification of custom models in a {provider/model_name} format.  Support for many of the providers listed above.  We should be able to select three
 * Dynamically set the token limit based on the model selected
 * Specify the model for the --agent-model (currently Claude)
 * Specify the output directory (currently .justbuild)
 * specify a pass/fail threshold for the review.  Should 'fail' if the review does not meet the threshold.
 * Give me an example of this in a CI/CD pipeline
 * Provide a list of --docs flags which can be used as meta data and added to the repomix file for analysis
 * Provide a --task flag which is a string to guide the analysis.