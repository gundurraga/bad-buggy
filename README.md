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

## Configuration (Optional)

Create `.github/ai-review-config.yml` to customize:

```yaml
# Maximum comments per review
max_comments: 10

# Files to ignore
ignore_patterns:
  - "*.md"
  - "tests/*"
  - "*.lock"
  - "dist/**"

# Custom instructions (appended to default prompt)
custom_prompt: |
  Focus on security, performance, and best practices.
  Be constructive and helpful.
```

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
