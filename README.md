# 🐰 bad-buggy

A simple, cost-effective GitHub Action that uses AI to review your pull requests. Supports both OpenRouter and Anthropic APIs with transparent cost tracking.

## Features

- 🤖 **AI-powered code reviews** using Claude (via Anthropic or OpenRouter)
- 💰 **Transparent cost tracking** - know exactly how much each review costs
- 🎯 **Customizable prompts** - tailor reviews to your project's needs
- 📊 **Smart comment limiting** - set max comments and prioritize by criticality
- 🏗️ **Architecture suggestions** - get high-level improvement ideas
- 🔧 **Simple configuration** - one YAML file to rule them all

## Quick Start

### 1. Add the workflow to your repository

Create `.github/workflows/ai-review.yml`:

```yaml
name: AI Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - name: AI Review
        uses: gundurraga/bad-buggy@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          ai-provider: "anthropic" # or 'openrouter'
          api-key: ${{ secrets.ANTHROPIC_API_KEY }} # or OPENROUTER_API_KEY
          model: "claude-3-haiku-20240307" # or claude-3-5-sonnet-20240620
```

### 2. Set up your API key

Go to your repository's Settings → Secrets and variables → Actions, and add:

- For Anthropic: `ANTHROPIC_API_KEY`
- For OpenRouter: `OPENROUTER_API_KEY`

### 3. (Optional) Customize the review

Create `.github/ai-review-config.yml`:

```yaml
# Review customization
review_prompt: |
  You are reviewing code for a Node.js web application.
  Focus on security, performance, and maintainability.
  Be constructive and suggest improvements.

# Comment settings
max_comments: 10
prioritize_by_severity: true

# What to review
review_aspects:
  - security_vulnerabilities
  - performance_issues
  - code_duplication
  - best_practices
  - architecture_suggestions
  - product_improvements

# Files to skip
ignore_patterns:
  - "*.md"
  - "*.json"
  - "tests/*"
```

## Configuration Options

### Workflow Inputs

| Input          | Description                                       | Default                        | Required |
| -------------- | ------------------------------------------------- | ------------------------------ | -------- |
| `github-token` | GitHub token for API access                       | -                              | Yes      |
| `ai-provider`  | AI provider to use (`anthropic` or `openrouter`)  | -                              | Yes      |
| `api-key`      | API key for the AI provider                       | -                              | Yes      |
| `model`        | AI model to use (e.g., `claude-3-haiku-20240307`) | -                              | Yes      |
| `config-file`  | Path to config file                               | `.github/ai-review-config.yml` | No       |

### Configuration File Options

| Option                   | Description                             | Default            |
| ------------------------ | --------------------------------------- | ------------------ |
| `review_prompt`          | Custom instructions for the AI reviewer | See default prompt |
| `max_comments`           | Maximum number of comments per review   | 15                 |
| `prioritize_by_severity` | Order comments by importance            | true               |
| `review_aspects`         | List of aspects to review               | All aspects        |
| `ignore_patterns`        | File patterns to skip                   | None               |

## Cost Tracking

bad-buggy automatically calculates and displays the cost of each review in the PR comments:

```
🐰 bad-buggy review completed with 5 comments

**Review Cost:**
- Model: claude-3-haiku-20240307
- Total cost: $0.0018
- Tokens: 2,543 input, 856 output
```

### Estimated Costs

| Model           | Cost per 1M tokens         | Avg PR Cost |
| --------------- | -------------------------- | ----------- |
| Claude 3 Haiku  | $0.25 input / $1.25 output | ~$0.002     |
| Claude 4 Sonnet | $3 input / $15 output      | ~$0.02      |

## Examples

### Security-Focused Configuration

```yaml
review_prompt: |
  You are a security expert reviewing code.
  Look for: SQL injection, XSS, authentication issues, 
  data exposure, and dependency vulnerabilities.

review_aspects:
  - security_vulnerabilities
  - authentication_issues
  - data_validation
```

### Architecture Review Configuration

```yaml
review_prompt: |
  Focus on high-level architecture and design patterns.
  Suggest improvements for scalability and maintainability.
  Consider microservices principles and clean architecture.

max_comments: 5
review_aspects:
  - architecture_suggestions
  - design_patterns
  - scalability_concerns
```

### Minimal Setup for bad-buggy itself

```yaml
name: bad-buggy self-review
on:
  pull_request:

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      - uses: gundurraga/bad-buggy@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          ai-provider: "anthropic"
          api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          model: "claude-3-haiku-20240307"
```

## How It Works

1. **Triggered on PR**: The action runs when a PR is opened or updated
2. **Fetches changes**: Gets the diff of all changed files
3. **Chunks intelligently**: Splits large PRs into manageable pieces
4. **Reviews with AI**: Sends chunks to AI with your custom prompt
5. **Posts comments**: Adds review comments directly on the PR
6. **Shows costs**: Reports the total cost of the review

### How Comments Appear

bad-buggy posts reviews as:

- **Inline comments** on specific lines of code
- **Summary comment** with total cost and review statistics
- Uses the GitHub Actions bot profile picture
- Groups all comments in a single review

Example summary comment:

```
🐰 bad-buggy review completed with 5 comments

**Review Cost:**
- Model: claude-3-haiku-20240307
- Total cost: $0.0018
- Tokens: 2,543 input, 856 output
```

## Privacy & Security

- Your code is sent to the AI provider you choose (Anthropic or OpenRouter)
- API keys are stored as GitHub secrets and never exposed
- Reviews are posted as comments on your PRs
- No data is stored or logged by this action

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a PR

## License

MIT License - see LICENSE file for details

## Support

- 🐛 [Report bugs](https://github.com/gundurraga/bad-buggy/issues)
- 💡 [Request features](https://github.com/gundurraga/bad-buggy/issues)
- 📖 [Read the wiki](https://github.com/gundurraga/bad-buggy/wiki)

## Roadmap

- [ ] Support for more AI providers (OpenAI, Cohere)
- [ ] Inline code suggestions
- [ ] Review conversation threads
- [ ] Cost budgets and limits
- [ ] Team-specific review profiles

---

Made with ❤️ by the open-source community
