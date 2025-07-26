#!/bin/bash

echo "🐰 bad-buggy Setup"
echo "=================="
echo ""

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo "❌ Error: Not in a git repository"
    echo "Please run this script from the root of your repository"
    exit 1
fi

# Create directories
echo "📁 Creating directories..."
mkdir -p .github/workflows

# Create workflow file
echo "📝 Creating workflow file..."
cat > .github/workflows/ai-review.yml << 'EOF'
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
          ai-provider: 'openrouter'
          api-key: ${{ secrets.OPENROUTER_API_KEY }}
          model: 'qwen/qwen3-coder'
EOF

# Create config file
echo "⚙️  Creating config file..."
cat > .github/ai-review-config.yml << 'EOF'
# bad-buggy Configuration

review_prompt: |
  Review this code for bugs, security issues, and improvements.
  Be constructive and specific.

max_comments: 10
prioritize_by_severity: true

review_aspects:
  - bugs
  - security_vulnerabilities
  - performance_issues
  - code_quality
  - best_practices

ignore_patterns:
  - "*.md"
  - "*.json"
  - "test/*"
EOF

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add your API key to repository secrets:"
echo "   - Go to Settings → Secrets and variables → Actions"
echo "   - Add ANTHROPIC_API_KEY or OPENROUTER_API_KEY"
echo "2. Customize .github/ai-review-config.yml for your project"
echo "3. Create a pull request to test!"
echo ""
echo "Happy reviewing! 🎉"