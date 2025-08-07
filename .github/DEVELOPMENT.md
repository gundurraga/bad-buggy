# Development & Release Guide

> Internal documentation for maintainers and contributors

## 🏷️ Git Tags & Release Management

### Current Problem with Force-Updating Tags
```bash
# ❌ DON'T DO THIS (what we used to do)
git tag -f v1 HEAD && git push origin v1 --force
```

**Issues:**
- Forces tag movement (breaks reproducibility)
- Users using `@v1` get different code unexpectedly  
- No release history tracking
- Can break existing workflows mid-execution

### ✅ Proper Release Flow

#### 1. Semantic Versioning (SemVer)
```
v1.0.0 → v1.0.1 → v1.1.0 → v2.0.0
Major.Minor.Patch
```

- **Patch** (`v1.0.1`): Bug fixes, security updates, no breaking changes
- **Minor** (`v1.1.0`): New features, backward compatible
- **Major** (`v2.0.0`): Breaking changes, API changes

#### 2. Release Process

**For new features (minor version):**
```bash
# 1. Create specific version tag
git tag v1.3.0
git push origin v1.3.0

# 2. Update major version pointer  
git tag -f v1 v1.3.0
git push origin v1 --force

# 3. Create GitHub release
gh release create v1.3.0 --title "v1.3.0 - Feature Name" --notes "
## New Features
- Added X functionality
- Enhanced Y feature

## Improvements  
- Better Z performance
"
```

**For bug fixes (patch version):**
```bash
git tag v1.2.1
git push origin v1.2.1
git tag -f v1 v1.2.1  
git push origin v1 --force
gh release create v1.2.1 --title "v1.2.1 - Bug Fixes"
```

**For breaking changes (major version):**
```bash
git tag v2.0.0
git push origin v2.0.0
# DON'T update v1 pointer for breaking changes!
gh release create v2.0.0 --title "v2.0.0 - Breaking Changes"
```

#### 3. Quick Commands Reference

```bash
# Check current tags
git tag --list | grep v1

# See what commit a tag points to  
git show-ref --tags | grep v1

# Create and push new version
make_release() {
  local version=$1
  git tag $version
  git push origin $version
  git tag -f v1 $version
  git push origin v1 --force
  gh release create $version --title "$version" --generate-notes
}

# Usage: make_release v1.3.0
```

### 🎯 Alternative Approach: Stable Versioning

**Consider recommending users pin to specific versions:**

```yaml
# ✅ Most stable - users control upgrades
uses: gundurraga/bad-buggy@v1.2.0

# ✅ Most secure - immutable  
uses: gundurraga/bad-buggy@690a74f

# ⚠️ Convenient but auto-updates
uses: gundurraga/bad-buggy@v1
```

## 🚀 Deployment Checklist

Before creating a new release:

- [ ] All tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`) 
- [ ] Build succeeds (`npm run build`)
- [ ] README updated if needed
- [ ] Breaking changes documented
- [ ] Security considerations reviewed

## 🔍 Debugging GitHub Actions

Common issues:

1. **Action not found**: Check tag exists and is pushed
2. **Permission errors**: Verify workflow permissions in repo settings
3. **API key issues**: Check secret names match exactly (case-sensitive)

## 📝 Commit Message Format

```
type(scope): description

- feat: new feature
- fix: bug fix  
- docs: documentation
- refactor: code refactor
- test: adding tests
- chore: maintenance
```

## 🗂️ Project Structure

```
src/
├── config.ts          # Default configuration
├── domains/           # Pure business logic
├── effects/           # Side effects (API, file system)
├── security/          # Authentication & authorization  
├── services/          # Orchestration layer
└── types.ts           # Type definitions
```

## 🔐 Security Notes

- Never commit API keys
- Always use GitHub Secrets for sensitive data
- Pin action versions in workflows
- Review third-party dependencies regularly
- Use least-privilege permissions

---

*This file is for maintainers only and not included in user documentation.*