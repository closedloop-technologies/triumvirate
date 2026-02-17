// Triumvirate BAML Types
// These types mirror the JSON schemas used in report-utils.ts and planAction.ts

// =============================================================================
// Category Extraction Types
// =============================================================================

class CategoryItem {
  name string @description("Category name (e.g., 'Security', 'Performance')")
  description string @description("Brief description of what this category covers")
}

class CategoryResponse {
  categories CategoryItem[] @description("List of review categories extracted from the code reviews")
}

// =============================================================================
// Findings Extraction Types
// =============================================================================

class CodeExample {
  code string @description("The code snippet")
  language string @description("Programming language of the snippet")
}

class FindingItem {
  title string @description("Concise title for the finding")
  description string @description("Detailed description of the finding")
  category string @description("Category this finding belongs to")
  isStrength bool @description("True if this is a positive finding, false if it's an issue")
  recommendation string? @description("Suggested fix or improvement")
  codeExample CodeExample? @description("Optional code example illustrating the finding")
  modelAgreement map<string, bool> @description("Maps model ID to whether it agrees with this finding")
}

class FindingsResponse {
  findings FindingItem[] @description("List of findings extracted from the reviews")
}

// =============================================================================
// Task Planning Types
// =============================================================================

enum TaskPriority {
  High @alias("high") @description("Critical issues that should be addressed immediately")
  Medium @alias("medium") @description("Important but not urgent issues")
  Low @alias("low") @description("Nice-to-have improvements")
}

enum TaskType {
  Bug @alias("bug") @description("Bug fix")
  Enhancement @alias("enhancement") @description("New feature or improvement")
  Debt @alias("debt") @description("Technical debt reduction")
  Docs @alias("docs") @description("Documentation update")
  Refactor @alias("refactor") @description("Code refactoring")
}

class Task {
  id string @description("Unique identifier (e.g., task-1)")
  title string @description("Concise title for the task")
  description string @description("Detailed description of what needs to be done")
  priority TaskPriority @description("Priority level of the task")
  dependencies string[] @description("List of task IDs this task depends on")
  type TaskType? @description("Type of task")
}

class PlanResponse {
  tasks Task[] @description("List of tasks extracted from the code review summary")
}

// =============================================================================
// Model Insights Types
// =============================================================================

class ModelInsight {
  modelId string @description("Identifier of the model")
  strengths string[] @description("What this model did well")
  weaknesses string[] @description("Areas where this model struggled")
  uniqueContributions string[] @description("Unique insights only this model provided")
}

class InsightsResponse {
  modelInsights ModelInsight[] @description("Insights about each model's performance")
}

// =============================================================================
// Priority Extraction Types
// =============================================================================

class PrioritizedResponse {
  highPriority string[] @description("Findings that need immediate attention")
  mediumPriority string[] @description("Important findings to address soon")
  lowPriority string[] @description("Nice-to-have improvements")
}
