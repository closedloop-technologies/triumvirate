# Triumvirate Usage

This guide covers common workflows for using Triumvirate to review your codebase.

## Prerequisites

1. **API Keys** - Set up at least one provider's API key:

   ```bash
   export OPENAI_API_KEY=your-openai-key
   export ANTHROPIC_API_KEY=your-anthropic-key
   export GEMINI_API_KEY=your-google-key
   ```

2. **Install Triumvirate**:

   ```bash
   npm install -g @justbuild/triumvirate
   ```

## Workflow 1: Basic Code Review

Run a full multi-model review of your codebase:

```bash
cd your-project
tri review
```

This will:

1. Package your codebase using Repomix
2. Send it to OpenAI, Claude, and Gemini in parallel
3. Synthesize findings and identify cross-model consensus
4. Generate reports in `.triumvirate/` directory

**Output files:**

- `tri-review-<timestamp>.md` - Human-readable Markdown report
- `tri-review-<timestamp>-enhanced.json` - Structured JSON with all findings

## Workflow 2: Focused Security Review

Run a security-focused review on changed files only:

```bash
tri review --diff --task "security focused code review"
```

This is ideal for:

- Pre-commit checks
- Pull request reviews
- Auditing specific changes

## Workflow 3: Review → Plan → Execute

Use the full workflow to turn review findings into actionable tasks:

```bash
# Step 1: Run the review
tri review

# Step 2: Generate a task plan from the review
tri plan

# Step 3: Get the next task to work on
tri next
```

The `plan` command breaks down review findings into prioritized tasks with dependencies. The `next` command shows you which task to tackle first.

## Workflow 4: CI/CD Integration

Add Triumvirate to your GitHub Actions workflow:

```yaml
- name: Run Triumvirate Review
  run: |
    npx @justbuild/triumvirate review \
      --diff \
      --fail-on-error \
      --pass-threshold lenient
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

## Workflow 5: Cost-Conscious Reviews

Use a single model or cheaper tier for routine reviews:

```bash
# Use only one model
tri review --models openai

# Use the cheap tier (faster, lower cost)
tri review --tier cheap

# Check model costs before running
tri models
```

## Common Options

| Option               | Description                              |
|----------------------|------------------------------------------|
| `--diff`             | Only review files changed in git diff    |
| `--models <list>`    | Comma-separated list of models to use    |
| `--tier <tier>`      | Model tier: cheap, standard, or premium  |
| `--task <desc>`      | Focus the review on a specific concern   |
| `--compress`         | Reduce token count via code compression  |
| `--output-dir <dir>` | Custom output directory                  |

## Tips

- **Start with `--diff`** for faster, cheaper reviews during development
- **Use `tri models`** to see available models and their costs
- **High consensus findings (🚨)** are the most reliable - prioritize these
- **Run `tri plan`** to convert findings into actionable tasks
