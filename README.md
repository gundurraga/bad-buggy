# 🐰⚡ Bad Buggy

**The smartest GitHub Action for AI-powered code reviews**

Get instant, educational feedback from Bad Buggy with transparent cost tracking and lightning-fast performance.

## ✨ What makes Bad Buggy special

- 🎓 **Educational reviews** - Learn while you code with detailed explanations
- 💰 **Real-time cost tracking** - See exactly what each review costs in PR comments
- 🚀 **Lightning fast** - Parallel processing for maximum speed
- 💬 **Smart commenting** - Both line-level and file-level insights
- 🔄 **Incremental reviews** - Only reviews new changes, not entire PR
- 🎯 **Quality focused** - Max 5 impactful comments per review
- 🛡️ **Security first** - Validates permissions and handles credentials safely

## 🚀 Quick Setup (2 minutes)

### 1. Add the workflow file

Create `.github/workflows/ai-review.yml`:

```yaml
name: Bad Buggy Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Bad Buggy Code Review
        uses: gundurraga/bad-buggy@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          ai-provider: "openrouter" # or "anthropic"
          api-key: ${{ secrets.OPENROUTER_API_KEY }} # or ${{ secrets.ANTHROPIC_API_KEY }}
          model: "anthropic/claude-sonnet-4-20250514" # OpenRouter format, or just "claude-sonnet-4-20250514" for Anthropic
```

### 2. Add your API key

Go to **Settings → Secrets and variables → Actions** and add:

- `ANTHROPIC_API_KEY` → Get yours at [console.anthropic.com](https://console.anthropic.com)
- Or `OPENROUTER_API_KEY` → Get yours at [openrouter.ai](https://openrouter.ai) (Access to 400+ models)

### 3. Done! 🎉

Your next pull request will get a Bad Buggy review with cost tracking right in the comments.

## 💬 What you get

**📊 Cost tracking right in your PR:**

```markdown
## 🐰⚡ Bad Buggy

### 🔍 Review Details

**Model:** claude-sonnet-4-20250514
**Total cost:** $0.0034 (equal to 294 reviews per dollar)
**Tokens:** 8,424 (7,858 input, 566 output)
**Comments:** 3
```

**🎯 Smart code insights:**

- **Line-level comments** - Specific suggestions on exact lines
- **File-level comments** - Overall architecture and design feedback
- **Educational explanations** - Learn the "why" behind each suggestion
- **Actionable solutions** - Code examples and specific improvements

## 🧠 AI-Powered Code Intelligence

### **What Bad Buggy reviews:**

- 🏗️ **Architecture** - Design patterns, SOLID principles, maintainability
- 🐛 **Bugs** - Edge cases, potential issues, error handling
- ⚡ **Performance** - Scalability, efficiency, resource usage
- 🔒 **Security** - Vulnerabilities, best practices, data protection
- 📚 **Best practices** - Industry standards, clean code principles
- 🎯 **Logic** - Algorithm efficiency, code clarity, maintainability

### **Review quality:**

- **Educational focus** - Every comment teaches you something new
- **Context-aware** - Understands your entire codebase structure
- **Actionable feedback** - Specific suggestions with code examples
- **Constructive tone** - Builds you up as a developer

## Configuration (Optional)

Create `.github/ai-review-config.yml` to customize the review for your specific project:

```yaml
# Maximum comments per review (recommended: 3 for focused feedback)
max_comments: 3

# Files to ignore
ignore_patterns:
  - "*.md"
  - "tests/*" # Add if you don't want test reviews
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

## 🤖 AI Provider Options

| Provider       | Best For                      | Models Available                        |
| -------------- | ----------------------------- | --------------------------------------- |
| **Anthropic**  | Direct Claude model access    | Claude-4, Claude-3.5, Claude-3          |
| **OpenRouter** | Model variety and flexibility | 400+ models (Claude, GPT, Gemini, etc.) |

### **💡 Model suggestions:**

Choose based on your needs - Bad Buggy works great with any model:

- **Latest models**: `claude-sonnet-4-20250514`, `gpt-4o`, `gemini-pro`
- **Budget-friendly**: `claude-3-5-haiku`, `gpt-4o-mini`
- **Specialized**: Browse 400+ models on OpenRouter

### **💰 Real-time pricing:**

Bad Buggy automatically fetches current pricing from providers, so you always see accurate costs - no surprises!

## 🛠️ Troubleshooting

**No comments appearing?**

- ✅ Check your API key is added as a repository secret
- ✅ Verify the workflow runs without errors in Actions tab
- ✅ Make sure your PR has actual code changes (not just README updates)

**Permission errors (`Resource not accessible by integration`)?**

This is the most common issue, especially in private repositories. Here's how to fix it:

1. **Go to your repository's Settings → Actions → General**
2. **Scroll down to "Workflow permissions"**
3. **Select "Read and write permissions"**
4. **Check "Allow GitHub Actions to create and approve pull requests"**
5. **Click Save**

This allows Bad Buggy to post review comments on your pull requests.

**Want more help?** [Open an issue](https://github.com/gundurraga/bad-buggy/issues) - we respond quickly!

---

## 🔒 Privacy & Security

- Your code is sent to your chosen AI provider for review
- No data is stored by Bad Buggy itself
- All API keys are handled securely through GitHub Secrets
- Full audit trail in GitHub Actions logs

## ⭐ Star us!

If Bad Buggy is helping you write better code, **[give us a star](https://github.com/gundurraga/bad-buggy)** ⭐

It helps other developers discover this tool and motivates us to keep improving it.

---

**Built with ❤️ by developers, for developers**

_MIT License - see LICENSE file for details_
