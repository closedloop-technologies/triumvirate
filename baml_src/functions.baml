// Triumvirate BAML Functions
// These functions replace the manual LLM calls in llm-providers.ts

// =============================================================================
// Code Review - Free-form completion
// =============================================================================

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
