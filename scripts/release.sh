#!/bin/bash

# Bad Buggy Release Script
# Usage: ./scripts/release.sh v1.3.0 "Feature description"

set -e

if [ $# -lt 1 ]; then
    echo "Usage: $0 <version> [description]"
    echo "Example: $0 v1.3.0 'New features and improvements'"
    exit 1
fi

VERSION=$1
DESCRIPTION=${2:-"Release $VERSION"}

echo "🚀 Creating release $VERSION..."

# Validate version format
if [[ ! $VERSION =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "❌ Invalid version format. Use: v1.2.3"
    exit 1
fi

# Check if we're on the right branch
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ] && [ "$BRANCH" != "master" ]; then
    echo "⚠️  Warning: You're not on main branch (current: $BRANCH)"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "❌ You have uncommitted changes. Please commit or stash them first."
    exit 1
fi

# Run tests and build
echo "🧪 Running tests and build..."
npm run lint
npm run build

# Create specific version tag
echo "🏷️  Creating tag $VERSION..."
git tag $VERSION
git push origin $VERSION

# Update v1 pointer (extract major version)
MAJOR_VERSION=$(echo $VERSION | cut -d. -f1)
echo "📌 Updating $MAJOR_VERSION pointer..."
git tag -f $MAJOR_VERSION $VERSION
git push origin $MAJOR_VERSION --force

# Create GitHub release
echo "📦 Creating GitHub release..."
gh release create $VERSION --title "$VERSION" --notes "$DESCRIPTION"

echo "✅ Release $VERSION created successfully!"
echo "🌐 View at: https://github.com/gundurraga/bad-buggy/releases/tag/$VERSION"
echo ""
echo "Users can now use:"
echo "  uses: gundurraga/bad-buggy@$VERSION"
echo "  uses: gundurraga/bad-buggy@$MAJOR_VERSION"