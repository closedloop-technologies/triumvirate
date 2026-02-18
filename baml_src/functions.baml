// Triumvirate BAML Functions
// These functions replace the manual LLM calls in llm-providers.ts

// =============================================================================
// Code Review - Per-model functions for parallel execution
// =============================================================================

function ReviewCodeWithClaude(code: string) -> string {
  client Claude
  prompt #"
    {{ _.role("system") }}
    You are an expert code reviewer with deep knowledge of software engineering best practices, security, performance, and maintainability.

    {{ _.role("user") }}
    Please review the following codebase for bugs, design flaws, and potential improvements:

    {{ code }}
  "#
}

function ReviewCodeWithGPT(code: string) -> string {
  client GPT4
  prompt #"
    {{ _.role("system") }}
    You are an expert code reviewer with deep knowledge of software engineering best practices, security, performance, and maintainability.

    {{ _.role("user") }}
    Please review the following codebase for bugs, design flaws, and potential improvements:

    {{ code }}
  "#
}

function ReviewCodeWithGemini(code: string) -> string {
  client Gemini
  prompt #"
    {{ _.role("system") }}
    You are an expert code reviewer with deep knowledge of software engineering best practices, security, performance, and maintainability.

    {{ _.role("user") }}
    Please review the following codebase for bugs, design flaws, and potential improvements:

    {{ code }}
  "#
}

// Fallback version for general use
function ReviewCode(code: string) -> string {
  client TriumvirateFallback
  prompt #"
    {{ _.role("system") }}
    You are an expert code reviewer with deep knowledge of software engineering best practices, security, performance, and maintainability.

    {{ _.role("user") }}
    Please review the following codebase for bugs, design flaws, and potential improvements:

    {{ code }}
  "#
}

// =============================================================================
// Category Extraction - Structured output
// =============================================================================

function ExtractCategories(reviews: string) -> CategoryResponse {
  client TriumvirateFallback
  prompt #"
    {{ _.role("system") }}
    You are an expert at analyzing code reviews and extracting meaningful categories.

    {{ _.role("user") }}
    Analyze the following code reviews and extract the main categories of issues and improvements mentioned.

    Reviews:
    {{ reviews }}

    {{ ctx.output_format }}
  "#
}

// =============================================================================
// Findings Extraction - Structured output
// =============================================================================

function ExtractFindings(reviews: string, categories: string, models: string) -> FindingsResponse {
  client TriumvirateFallback
  prompt #"
    {{ _.role("system") }}
    You are an expert at analyzing code reviews and extracting specific findings.

    {{ _.role("user") }}
    Extract specific findings from these code reviews. For each finding, determine which models agree with it.

    Reviews:
    {{ reviews }}

    Categories to use:
    {{ categories }}

    Models that provided reviews:
    {{ models }}

    {{ ctx.output_format }}
  "#
}

// =============================================================================
// Model Insights - Structured output
// =============================================================================

function GenerateInsights(reviews: string, models: string) -> InsightsResponse {
  client TriumvirateFallback
  prompt #"
    {{ _.role("system") }}
    You are an expert at analyzing and comparing LLM model outputs.

    {{ _.role("user") }}
    Analyze the following code reviews from different models and generate insights about each model's performance.

    Reviews:
    {{ reviews }}

    Models:
    {{ models }}

    {{ ctx.output_format }}
  "#
}

// =============================================================================
// Priority Extraction - Structured output
// =============================================================================

function ExtractPriorities(findings: string) -> PrioritizedResponse {
  client TriumvirateFallback
  prompt #"
    {{ _.role("system") }}
    You are an expert at prioritizing software development tasks.

    {{ _.role("user") }}
    Prioritize the following findings into high, medium, and low priority categories.

    Findings:
    {{ findings }}

    {{ ctx.output_format }}
  "#
}

// =============================================================================
// Task Plan Generation - Structured output
// =============================================================================

function GeneratePlan(summary: string, task: string?) -> PlanResponse {
  client TriumvirateFallback
  prompt #"
    {{ _.role("system") }}
    You are an expert project manager who creates actionable task plans from code review summaries.

    {{ _.role("user") }}
    Based on the code review summary below, generate a list of actionable tasks.

    Summary:
    {{ summary }}

    {% if task %}
    Specific focus area:
    {{ task }}

    When generating tasks, prioritize addressing the specific task described above.
    {% endif %}

    For each task:
    1. Assign a unique ID (e.g., task-1, task-2)
    2. Create a concise title
    3. Write a detailed description explaining what needs to be done
    4. Assign a priority (high, medium, or low)
    5. List any dependencies (other task IDs that must be completed first)
    6. Assign a type (bug, enhancement, debt, docs, or refactor)

    Ensure that the tasks are concrete, actionable, and directly related to the code review findings.
    Prioritize tasks that address critical issues or have the highest impact.

    {{ ctx.output_format }}
  "#
}

// =============================================================================
// Smart Compression - Structured output for file selection
// =============================================================================

function RecommendCompression(
  directoryStructure: string,
  fileTokenCounts: string,
  totalTokens: int,
  tokenLimit: int,
  task: string
) -> CompressionRecommendation {
  client TriumvirateFallback
  prompt #"
    {{ _.role("system") }}
    You are a code review preparation assistant. Your job is to help select the most relevant files from a codebase for a specific review task.

    {{ _.role("user") }}
    Given the repository structure and file token counts, recommend which files to INCLUDE or EXCLUDE to fit within the token limit while maximizing relevance to the task.

    IMPORTANT GUIDELINES:
    - Prioritize files most relevant to the task
    - Always include core source files (src/, lib/) over generated files
    - Exclude test files, documentation, and config files if space is tight (unless the task is about those)
    - Exclude large generated files (dist/, build/, node_modules/)
    - Exclude lock files (package-lock.json, yarn.lock)
    - Consider file token counts when making decisions

    ## Repository Structure
    {{ directoryStructure }}

    ## Top Files by Token Count
    {{ fileTokenCounts }}

    ## Total Tokens: {{ totalTokens }}
    ## Target Token Limit: {{ tokenLimit }}
    ## Tokens to Reduce: {{ totalTokens - tokenLimit }}

    ## Review Task
    {{ task }}

    {{ ctx.output_format }}
  "#
}
