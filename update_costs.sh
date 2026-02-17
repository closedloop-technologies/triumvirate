#!/usr/bin/env bash

# update_costs.sh - Download and transform LLM costs data
# Usage: ./update_costs.sh [MIN_INPUT_TOKENS]
# Default MIN_INPUT_TOKENS is 100000

set -euo pipefail

MIN_INPUT_TOKENS="${1:-100000}"
URL="https://raw.githubusercontent.com/BerriAI/litellm/refs/heads/main/model_prices_and_context_window.json"
TMP_FILE="model_prices_and_context_window.json"
OUTPUT_FILE="llm_costs.json"

if ! command -v jq &> /dev/null; then
  echo "Error: jq is required but not installed. Please install jq." >&2
  exit 1
fi

# Download the JSON file
echo "Downloading model prices and context window data..."
curl -fsSL "$URL" -o "$TMP_FILE"

echo "Filtering models with max_input_tokens >= $MIN_INPUT_TOKENS and transforming data format..."

# Filter and transform the data
jq --argjson min "$MIN_INPUT_TOKENS" '
  to_entries | 
  map(
    select(
      (.value.max_input_tokens | type == "number") and
      (.value.max_input_tokens >= $min) and
      (.value.input_cost_per_token != null) and
      (.value.output_cost_per_token != null)
    ) | {
      model: .key,
      provider: .value.litellm_provider,
      input: .value.input_cost_per_token,
      output: .value.output_cost_per_token,
      max_input_tokens: .value.max_input_tokens,
      max_output_tokens: .value.max_output_tokens
    }
  )
' "$TMP_FILE" > "$OUTPUT_FILE"

echo "Transformed results saved to $OUTPUT_FILE."

# Print the total number of models
NUM_MODELS=$(jq 'length' "$OUTPUT_FILE")
echo "Total models: $NUM_MODELS"

# Print the number of models per provider
jq -r 'map(.provider) | .[]' "$OUTPUT_FILE" | \
  sort | uniq -c | awk '{printf "%-20s %s\n", $2, $1}' | \
  sed 's/^/Provider count: /'

# Cleanup
rm "$TMP_FILE" || rm -f "$TMP_FILE"
