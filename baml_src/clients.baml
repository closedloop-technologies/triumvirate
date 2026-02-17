// Triumvirate LLM Clients
// Learn more at https://docs.boundaryml.com/docs/snippets/clients/overview

// =============================================================================
// Primary Providers - Match existing triumvirate models
// =============================================================================

// Claude (Anthropic) - Primary provider
client<llm> Claude {
  provider anthropic
  retry_policy Exponential
  options {
    model "claude-3-7-sonnet-20250219"
    api_key env.ANTHROPIC_API_KEY
    max_tokens 4096
  }
}

// OpenAI GPT-4.1
client<llm> GPT4 {
  provider openai
  retry_policy Exponential
  options {
    model "gpt-4.1"
    api_key env.OPENAI_API_KEY
  }
}

// Google Gemini
client<llm> Gemini {
  provider google-ai
  retry_policy Exponential
  options {
    model "gemini-2.5-pro-preview-06-05"
    api_key env.GEMINI_API_KEY
  }
}

// =============================================================================
// Fallback Strategy - Tries providers in order until one succeeds
// =============================================================================

client<llm> TriumvirateFallback {
  provider fallback
  options {
    strategy [Claude, GPT4, Gemini]
  }
}

// =============================================================================
// Retry Policies
// =============================================================================

retry_policy Constant {
  max_retries 3
  strategy {
    type constant_delay
    delay_ms 200
  }
}

retry_policy Exponential {
  max_retries 3
  strategy {
    type exponential_backoff
    delay_ms 1000
    multiplier 1.5
    max_delay_ms 10000
  }
}