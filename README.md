# 🐰⚡ Bad Buggy

A simple, cost-effective GitHub Action that uses AI to review and comment your pull requests. Get instant feedback with transparent cost tracking.

## What it does

- 🐰⚡ **Bad Buggy code reviews** using Claude models
- 💰 **Transparent cost tracking** - see exactly what each review costs
- 🎯 **Smart commenting** - focuses on critical issues first
- 🔧 **Easy setup** - just add a workflow file

## Quick Setup

### 1. Add the workflow

Create `.github/workflows/ai-review.yml`:

```yaml
name: Bad Buggy Code Review
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
          ai-provider: "anthropic" # or "openrouter"
          api-key: ${{ secrets.ANTHROPIC_API_KEY }} # or OPENROUTER_API_KEY
          model: "claude-sonnet-4-20250514"
```

### 2. Set repository permissions

Go to **Settings → Actions → General**:

- Select **"Read and write permissions"**
- Check **"Allow GitHub Actions to create and approve pull requests"**
- Click **Save**

### 3. Add your API key

Go to **Settings → Secrets and variables → Actions** and add one of:

- `ANTHROPIC_API_KEY` (get it from [console.anthropic.com](https://console.anthropic.com))
- `OPENROUTER_API_KEY` (get it from [openrouter.ai](https://openrouter.ai))

That's it! Bad Buggy will now review your pull requests.

## Example Output

When a review is complete, you'll see a comment like this:

```
Bad Buggy review completed with 5 comments

Review Cost:
Model: claude-sonnet-4-20250514
Total cost: $0.0469 (equal to 21 reviews per dollar)
Tokens: 7,858 input, 1,556 output
```

Plus individual comments on specific lines of your code pointing out issues and suggestions.

## Thoughtful Code Review Approach

Bad Buggy provides comprehensive, educational code reviews that help developers grow. Here's what makes it different:

### 🎯 **Focused & Impactful**
- **Maximum 3 comments per review** - Quality over quantity
- **Teaches while reviewing** - Explains the "why" behind suggestions
- **Prioritizes architectural thinking** - Focuses on design patterns, maintainability, and long-term impact
- **Rich markdown formatting** - Uses code blocks, headers, and formatting for clarity
- **Comprehensive explanations** - Comments are as long as needed to fully teach the concept

### 🧠 **What It Looks For**
- **Code design and architecture** - Is this the right approach?
- **Potential bugs and edge cases** - What could go wrong?
- **Performance implications** - Will this scale?
- **Security considerations** - Are there vulnerabilities?
- **Maintainability** - Will future developers understand this?
- **Best practices** - Industry standards and proven patterns

### 💡 **Review Philosophy**
- **Constructive and motivational** - Builds up developers, doesn't tear down
- **Context-aware** - Understands your project structure and patterns
- **Educational** - Each comment is a comprehensive learning opportunity
- **Practical** - Provides actionable suggestions with detailed explanations

## Configuration (Optional)

Create `.github/ai-review-config.yml` to customize the review for your specific project:

```yaml
# Maximum comments per review (recommended: 3 for focused feedback)
max_comments: 3

# Files to ignore
ignore_patterns:
  - "*.md"
  - "tests/*"  # Add if you don't want test reviews
  - "*.lock"
  - "dist/**"

# Project-specific context and standards
custom_prompt: |
  ## Project Context
  This is a React TypeScript e-commerce application with Node.js backend.
  
  ## Architecture Standards
  We follow Clean Architecture with Domain-Driven Design principles.
  
  ## Technology Requirements
  - React components should use hooks and functional patterns
  - All API endpoints must include proper OpenAPI documentation
  - Database queries should use Prisma with proper typing
  
  ## Security Standards
  - All user inputs must be validated and sanitized
  - PCI compliance required for payment processing code
```

### 📝 **Writing Effective Custom Prompts**

The custom prompt should provide context that helps the AI understand your specific project needs. Use the template in `.github/ai-review-config-example.yml` and fill in sections relevant to your project:

- **Project Context**: What type of application, tech stack, domain
- **Architecture Standards**: Patterns and principles your team follows
- **Technology Requirements**: Framework-specific best practices
- **Security Standards**: Domain-specific security requirements
- **Performance Standards**: Your performance expectations
- **Business Domain**: Industry-specific considerations

The more context you provide, the more targeted and valuable the reviews become.

### Always Enabled Features

- ✅ **Incremental reviews** - Only reviews new changes since last review
- ✅ **Smart context** - Provides ~100 lines around each change for better understanding
- ✅ **Repository structure** - AI understands your project layout
- ✅ **Cost optimization** - Efficient chunking and context management

## Supported Providers

| Provider   | Models Available                        | Cost Range      |
| ---------- | --------------------------------------- | --------------- |
| Anthropic  | All Claude models (Haiku, Sonnet, Opus) | ~$0.002-0.05/PR |
| OpenRouter | 400+ models including Claude, GPT, etc. | ~$0.001-0.10/PR |

Choose your provider based on your needs:

- **Anthropic**: Direct access to Claude models
- **OpenRouter**: Access to multiple AI providers, often cheaper rates

## Troubleshooting

**"Resource not accessible by integration" error?**

- Check repository permissions in Settings → Actions → General
- Make sure you selected "Read and write permissions"

**No comments appearing?**

- Verify your API key is added as a repository secret
- Check the workflow logs for any errors

## Privacy

Your code is sent to your chosen AI provider (Anthropic or OpenRouter) for review. No data is stored by this action.

## License

MIT License - see LICENSE file for details
