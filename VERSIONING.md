# bad-buggy Versioning Strategy

## How Versioning Works

### Tag Structure

- **`v1`** - Latest stable 1.x version (floating tag)
- **`v1.0.0`** - Specific patch release (immutable)
- **`v1.1.0`** - Minor feature release (immutable)
- **`v2`** - Major version with breaking changes (floating tag)

### When You Make Changes

#### 1. **Patch Releases** (bug fixes, prompt improvements)

```bash
# After making changes and testing
git tag v1.0.1 -m "Fix JSON parsing for Claude 4"
git push origin v1.0.1

# Update floating v1 tag
git tag -f v1 v1.0.1
git push origin v1 --force
```

#### 2. **Minor Releases** (new features, new models)

```bash
git tag v1.1.0 -m "Add support for new AI models"
git push origin v1.1.0

# Update floating v1 tag
git tag -f v1 v1.1.0
git push origin v1 --force
```

#### 3. **Major Releases** (breaking changes)

```bash
git tag v2.0.0 -m "Breaking: New configuration format"
git push origin v2.0.0

# Create new floating tag
git tag v2 v2.0.0
git push origin v2
```

## User Perspective

Users reference your action like:

- `gundurraga/bad-buggy@v1` - Always latest stable (auto-updates)
- `gundurraga/bad-buggy@v1.0.1` - Pinned to specific version
- `gundurraga/bad-buggy@v2` - Latest v2.x when available

## Your Workflow

1. Make changes to `index.js`
2. Run `npm run build`
3. Commit both source and `dist/`
4. Create version tag
5. Update floating tag (`v1`)
6. Push everything

This way, users on `@v1` automatically get your improvements!
