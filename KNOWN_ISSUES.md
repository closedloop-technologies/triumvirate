# Triumvirate v0.4.0 — Open Issues  
*(run timestamp 2025-06-14, command `npm run dev -- review`)*

Below is a decision-ready list of problems uncovered in the latest Triumvirate review run, grouped with MoSCoW priorities and concrete next actions. Hand this straight to the junior dev and track it via the check-boxes.

---

## Must ✅ — fix before the next tagged release

| ✔︎ | Issue | Evidence (log snippet / pointer) | Action |
|---|-------|-----------------------------------|--------|
| [ ] **Phantom “Claude” row in API-usage breakdown** | `Claude                :   1 calls, $0.0000` | Section *MODEL BREAKDOWN* | Normalise model-name strings. No generic “Claude”; always use fully-qualified IDs. |
| [ ] **All cost calculations are `$0.0000`** | *API USAGE SUMMARY* shows `$0.0000` despite ≈202 k tokens | Pricing table or usage parsing is missing/wrong | Wire real price data per provider + multiply by token usage. |
| [ ] **Mismatch between declared and actual models** | Pre-flight lists `claude-opus-4-20250514`, but `claude-3-7-sonnet-20250219` is invoked five times | Options / model-array vs. *FINDINGS* section | Ensure the models checked at startup are the same ones passed to `executeReviews()`. |

---

## Should 🔶 — fix soon, but not release-blocking

| ✔︎ | Issue | Evidence | Action |
|---|-------|----------|--------|
| [ ] **Duplicate Anthrop-ic rows** (generic + specific) | Same *MODEL BREAKDOWN* section | Resolves automatically when model-name normalisation is fixed. |
| [ ] **Ambiguous `agentModel: "claude"` option** | Options dump near top of log | Replace with exact provider/model slug or drop param if unused. |

---

## Could ✨ — nice-to-have polish

| ✔︎ | Issue | Evidence | Action |
|---|-------|----------|--------|
| [ ] Cosmetic header says **“Claude CATEGORIES”** (hard-coded) | Header in categories extraction section | Rename dynamically to chosen summariser model or generic “Review Categories”. |

---

### Already fixed (no further action)

| Issue | Status |
|-------|--------|
| OpenAI request abort | **Resolved** (OpenAI/o3 completed cleanly) |
| Output directory default | **Resolved** (files written to `./.triumvirate`) |

---

### Quick next steps for the dev

1. **Model-name normalisation**  
   *Centralise* a helper that converts provider/model IDs to a canonical slug and use it everywhere (options dump, logging, cost tally).

2. **Cost accounting**  
   - Add a price-lookup map `{provider, model} → $per-1k-tokens`.  
   - Multiply input + output token counts accordingly.  
   - Re-compute the total and per-model costs.

3. **Model-array hygiene**  
   - The list returned by `getEnabledModels()` (or equivalent) must feed both the *key-check* and the *executeReviews()* call.

4. **Config cleanup**  
   - Replace any free-text model placeholders (`"claude"`) with strict slugs or remove if unused.  
   - Update docs and sample configs.

5. **UI polish** (after core fixes)  
   - Swap hard-coded headings for template strings.

When the above **Must** items are green-boxed, cut a patch version (0.4.x) and rerun the end-to-end tests.
