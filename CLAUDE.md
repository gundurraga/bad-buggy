# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bad Buggy is a GitHub Action that provides AI-powered code reviews for pull requests using various AI models from multiple providers (Anthropic, OpenRouter, etc.). It focuses on educational, constructive feedback with transparent cost tracking and incremental review capabilities.

## Important: Provider Neutrality

Bad Buggy is designed to be provider-neutral and model-agnostic. When working on this codebase:

- **DO NOT** favor any specific AI provider (Anthropic, OpenRouter, etc.) in code, documentation, or recommendations
- **DO NOT** hardcode pricing - always use real-time pricing APIs
- **DO** treat all providers and models equally
- **DO** let users choose their preferred provider and model based on their needs
- **DO** refer to the product as "Bad Buggy" rather than generic terms like "AI reviewer"

The goal is to provide users maximum flexibility in choosing their AI provider while maintaining consistent Bad Buggy functionality.

## Development Commands

### Build and Compilation
```bash
npm run build      # Full build with ncc bundling
npm run compile    # TypeScript compilation only  
npm run dev        # Watch mode for development
```

### Code Quality
```bash
npm run lint      # ESLint on src/**/*.ts with TypeScript rules
```

### Local Development
The Action is built using TypeScript and bundled with ncc. Main entry point is `src/main.ts` which exports a `run()` function that orchestrates the entire review workflow.

## Architecture

### Core Architecture Pattern
The codebase follows a **functional core, imperative shell** architecture with domain-driven design:

- **Domains** (`src/domains/`): Pure business logic functions for cost calculation, GitHub formatting, review processing, and security validation
- **Effects** (`src/effects/`): Impure side effects for AI API calls, file system operations, and GitHub API interactions  
- **Services** (`src/services/`): Orchestration layer that coordinates domains and effects
- **Types** (`src/types.ts`): Comprehensive type definitions for all domain objects

### Workflow Orchestration
The main workflow is managed by `ReviewWorkflow` class in `src/services/workflow.ts` which:
1. Validates inputs and configuration
2. Performs security checks and permission validation
3. Processes incremental diffs (only reviews new changes)
4. Chunks large diffs for AI processing
5. Posts review comments and cost summaries

### Security Model
- `CredentialManager` singleton handles API key management
- User permission validation through GitHub API
- Security checks for fork-based PRs and user allowlists
- Access control validation in `src/security/access-control.ts`

### AI Provider Abstraction
- Supports Anthropic and OpenRouter providers
- Token counting and cost calculation per provider
- Provider-specific response handling in `src/effects/ai-api.ts`

## Configuration System

### Default Configuration
Located in `src/config/default-config.ts` with comprehensive review prompts focusing on:
- Architecture and design patterns
- Code quality and best practices  
- Educational feedback approach
- Maximum 5 high-impact comments per review

### User Configuration
Users can override defaults via `.github/ai-review-config.yml`:
- Custom prompts for project-specific context
- File ignore patterns
- User allowlists
- Comment limits

## Key Features

### Incremental Reviews
- Tracks review state per PR in repository
- Only reviews new commits since last review
- Contextual awareness of previous reviews

### Enhanced Context System
- Repository structure analysis
- ±150 lines of context around changes with function boundaries
- Package.json analysis for project understanding
- Smart comment categorization to prevent repetitive suggestions
- Architecture-aware prompting to avoid bad recommendations

### Cost Optimization
- Intelligent diff chunking to stay within token limits
- Transparent cost reporting with per-review breakdowns
- Provider-specific pricing calculations

## Development Notes

### TypeScript Configuration
- Strict type checking enabled
- CommonJS modules targeting ES2020
- Source maps and declarations generated
- Test files excluded from compilation

### Error Handling & Logging
- Custom error types: `ConfigValidationError`, `AIProviderError`
- Actionable error messages with specific fix instructions
- Structured error classification with specific exit codes
- Comprehensive logging through `Logger` service with detailed progress tracking
- Enhanced credential validation with provider-specific guidance

### GitHub Action Integration
- Action metadata in `action.yml` with comprehensive input definitions
- Built artifact is `dist/index.js` (bundled with ncc)
- Requires Node 20 runtime
- Input validation through GitHub Actions core library
- Handles both diff-level and file-level comments correctly
- Supports incremental reviews with state tracking

## Release Management

### Release Process
Bad Buggy uses semantic versioning with automated release scripts:
- `scripts/release.sh` handles version tagging and GitHub releases
- Maintains both specific versions (`v1.2.1`) and major version pointers (`v1`)
- Comprehensive pre-release checks (lint, build validation)
- Automatic cost impact documentation

### Security Best Practices
- Commit SHA pinning recommended for production use
- Fork-based PR handling with proper security checks
- API key management through `CredentialManager` singleton
- Transparent cost tracking and usage monitoring

## Bad Buggy Philosophy

### Educational Focus
- Provides constructive, learning-oriented feedback
- Focuses on architecture and design patterns
- Maximum 5 high-impact comments per review
- Avoids overwhelming developers with minor issues

### Provider Neutrality
- No favoritism towards any AI provider
- Real-time pricing APIs (no hardcoded costs)
- Consistent experience across all supported models
- User choice prioritized over opinionated defaults

### Cost Transparency
- Per-review cost breakdowns with detailed analysis
- Reviews-per-dollar efficiency metrics
- Monthly usage estimates for budgeting
- No hidden fees or surprise charges