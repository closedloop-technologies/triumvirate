# Project Roadmap

This file outlines planned features and areas of improvement.

## Implemented ✅

- Multi-model code reviews (OpenAI, Claude, Gemini)
- Cross-model consensus detection with agreement indicators
- Model tier selection (cheap, standard, premium)
- `--agent-model` option for report generation and planning
- `--pass-threshold` for strict/lenient/none acceptance criteria
- GitHub Actions integration
- Cost transparency and token usage reporting
- Shell completion (`tri install`)
- **PR Summary Comments** - Automatic summary comments on pull requests
- **Inline PR Comments** - File-specific comments with line numbers

## In Progress 🚧

- BAML integration for structured outputs
- Automatic model cost updates via workflow

## Planned Features

### CLI Enhancements

- Configuration file support (`~/.triumvirate/config.json` or `.triumviraterc`)
- Interactive mode for easier command setup
- Plugin system for extending functionality
- Integration with issue tracking systems (GitHub Issues, Jira)

### Review Workflow

- Automatic repomix re-runs when token limits are exceeded
- Smarter file filtering based on review focus
- Incremental reviews (only re-review changed sections)
- Custom prompt templates per project

### Additional Features

- Support for additional LLM providers (Mistral, Cohere, local models)
- Web UI for viewing and comparing reviews
- Review history and trend tracking
- Team collaboration features

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to help with these features.
