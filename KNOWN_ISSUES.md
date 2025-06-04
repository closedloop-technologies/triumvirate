HEre's an example from a recent run:

```
npm run dev -- review

> @justbuild/triumvirate@0.4.0 dev
> tsx src/bin/triumvirate.ts review

▓▓ [INFO] API call logging initialized. Logs will be saved to: /home/gizmo/Documents/repos/triumvirate/tri-review-api-calls.jsonl
directories: [ '.' ]
options: {
  doc: [],
  agentModel: 'claude',
  outputDir: './.triumvirate',
  passThreshold: 'none'
}

📦 Triumvirate v0.4.0

Checking API keys for models: openai/gpt-4.1, anthropic/claude-3-7-sonnet-20250219, gemini/gemini-2.5-pro-preview-03-25
▓▓ [INFO] ✅ API key validation passed.
(▓▒░     ) Preparing codebase with Repomix...
Packaging codebase with repomix...
┌────────────────────────────────────────────────────────────────────────────────┐
│ Calculating metrics... (87/91) README.md                            │
│ Calculating metrics... (88/91) repomix.config.json                  │
│ Calculating metrics... (89/91) ROADMAP.md                           │
│ Calculating metrics... (90/91) update_costs.sh                      │
│ Calculating metrics... (91/91) USAGE.md                             │
└────────────────────────────────────────────────────────────────────────────────┘
Codebase packaged with 41557 tokens
⟨====    ⟩ Executing reviews across models...
(▓▒░     )  [openai/gpt-4.1, anthropic/claude-3-7-sonnet-20250219, gemini/gemini-2.5-pro-preview-03-25]
⟨==      ⟩  [openai/gpt-4.1, anthropic/claude-3-7-sonnet-20250219, gemini/gemini-2.5-pro-preview-03-25]
Original OpenAI error: APIUserAbortError: Request was aborted.
    at OpenAI.makeRequest (/home/gizmo/Documents/repos/triumvirate/node_modules/openai/src/core.ts:485:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async <anonymous> (/home/gizmo/Documents/repos/triumvirate/src/utils/llm-providers.ts:495:34)
    at async withErrorHandlingAndRetry (/home/gizmo/Documents/repos/triumvirate/src/utils/error-handling.ts:441:28)
    at async runModelReview (/home/gizmo/Documents/repos/triumvirate/src/models.ts:120:26)
    at async <anonymous> (/home/gizmo/Documents/repos/triumvirate/src/index.ts:127:49)
    at async Promise.all (index 0)
    at async executeReviews (/home/gizmo/Documents/repos/triumvirate/src/index.ts:122:21)
    at async runTriumvirateReview (/home/gizmo/Documents/repos/triumvirate/src/index.ts:394:30)
    at async Command.runCliAction (/home/gizmo/Documents/repos/triumvirate/src/cli/actions/runAction.ts:119:25) {
  status: undefined,
  headers: undefined,
  request_id: undefined,
  error: undefined,
  code: undefined,
  param: undefined,
  type: undefined
}
[unknown] OpenAI: OpenAI API error: Request was aborted.
Original error stack: Error: Request was aborted.
    at OpenAI.makeRequest (/home/gizmo/Documents/repos/triumvirate/node_modules/openai/src/core.ts:485:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async <anonymous> (/home/gizmo/Documents/repos/triumvirate/src/utils/llm-providers.ts:495:34)
    at async withErrorHandlingAndRetry (/home/gizmo/Documents/repos/triumvirate/src/utils/error-handling.ts:441:28)
    at async runModelReview (/home/gizmo/Documents/repos/triumvirate/src/models.ts:120:26)
    at async <anonymous> (/home/gizmo/Documents/repos/triumvirate/src/index.ts:127:49)
    at async Promise.all (index 0)
    at async executeReviews (/home/gizmo/Documents/repos/triumvirate/src/index.ts:122:21)
    at async runTriumvirateReview (/home/gizmo/Documents/repos/triumvirate/src/index.ts:394:30)
    at async Command.runCliAction (/home/gizmo/Documents/repos/triumvirate/src/cli/actions/runAction.ts:119:25)
Error context: { modelName: 'OpenAI' }
⟨======= ⟩  [openai/gpt-4.1, anthropic/claude-3-7-sonnet-20250219, gemini/gemini-2.5-pro-preview-03-25]
░░ Failed to complete review across all models (121699ms): [openai/gpt-4.1, anthropic/claude-3-7-sonnet-20250219, gemini/gemini-2.5-pro-
preview-03-25]
⟨======= ⟩ Finding common categories...
⟨12:46:55⟩ ██ 🤖 Claude CATEGORIES ⟨6582⟩⟨429⟩ $0.0000
┌─────────────────────────────────────────────────────┐
│         █▓▒░ REVIEW CATEGORIES DETECTED ░▒▓█        │
└─────────────────────────────────────────────────────┘
[01] ⟨Code Quality and Readability⟩
[02] ⟨Architecture and Design⟩
[03] ⟨Error Handling⟩
[04] ⟨Performance Optimization⟩
[05] ⟨Security Considerations⟩
[06] ⟨Potential Bugs and Issues⟩
[07] ⟨Code Duplication and Redundancy⟩
⟨======= ⟩ Extracting specific findings from reviews...
⟨12:48:09⟩ ██ 🤖 claude-3-7-sonnet-20250219 FINDINGS ⟨7260⟩⟨5099⟩ $0.0000
┌─────────────────────────────────────────────────────┐
│          █▓▒░  21 FINDINGS EXTRACTED ░▒▓█           │
└─────────────────────────────────────────────────────┘
Key Findings:          05 ✅ | 16 ❌
Improvement Agreement: 00 🚨 | 03 ❗ | 13 ⚠️
❗ 3 findings have partial agreement across models
1. Inconsistent error handling patterns
2. Synchronous file operations blocking the event loop
3. Command injection risk in shell commands
──────────────────────────────────────────────────
┌─────────────────────────────────────────────────────┐
│     █▓▒░ FINDINGS DISTRIBUTION BY CATEGORY ░▒▓█     │
└─────────────────────────────────────────────────────┘
 [02] ⟨Code Quality and Readability⟩
 [03] ⟨Architecture and Design⟩
 [03] ⟨Error Handling⟩
 [02] ⟨Performance Optimization⟩
 [05] ⟨Security Considerations⟩
 [04] ⟨Potential Bugs and Issues⟩
 [02] ⟨Code Duplication and Redundancy⟩
 [00] ⟨Unknown Category⟩
⟨======= ⟩ Extracting model insights...
██ Triumvirate report generation complete
██ Enhanced report generated using claude.
⟨======= ⟩ Writing output files to ./.triumvirate...
Writing JSON report to: ./.triumvirate-enhanced.json
██ Output files written successfully.
██ Triumvirate review completed successfully!
Cleaned up temporary repomix file.
┌─────────────────────────────────────────────────────┐
│             █▓▒░ API USAGE SUMMARY ░▒▓█             
├─────────────────────────────────────────────────────┤
 Total API Calls:           8  
 Total Cost:           $0.0000          
 Total Tokens:         148290  (130444 input, 17846 output)
├─────────────────────────────────────────────────────┤
│             █▓▒░  MODEL BREAKDOWN  ░▒▓█             │
├─────────────────────────────────────────────────────┤
 claude-3-7-sonnet-20250219:   6 calls, $0.0000 
 gemini-2.5-pro-preview-03-25:   1 calls, $0.0000 
 Claude                :   1 calls, $0.0000 
└─────────────────────────────────────────────────────┘
```

We see the following issues:
1. 'Claude' is a model name, should be 'claude-3.7-sonnet-20250219'
2. 'Cost calculations are incorrect (all zeros, shouldn't be)
3. 'OpenAI call was canceled for some reason'
4. Output sent to '.' and not '.triumvirate/'

