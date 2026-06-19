// Triumvirate LLM Clients
// Learn more at https://docs.boundaryml.com/docs/snippets/clients/overview

// =============================================================================
// Primary Providers - Match current triumvirate model defaults
// =============================================================================

// Claude (Anthropic) - latest Opus-tier model for complex reasoning and agentic coding
client<llm> Claude {
  provider anthropic
  retry_policy Exponential
  options {
    model "claude-opus-4-8"
    api_key env.ANTHROPIC_API_KEY
    max_tokens 4096
  }
}

// OpenAI flagship coding/reasoning model
client<llm> GPT4 {
  provider openai
  retry_policy Exponential
  options {
    model "gpt-5.5"
    api_key env.OPENAI_API_KEY
  }
}

// Google Gemini premium coding/reasoning model
client<llm> Gemini {
  provider google-ai
  retry_policy Exponential
  options {
    model "gemini-3.1-pro-preview"
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
