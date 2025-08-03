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

### Testing and Quality
```bash
npm test          # Run Jest tests
npm run lint      # ESLint on src/**/*.ts
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

### Smart Context
- Repository structure analysis
- ~100 lines of context around changes
- Package.json analysis for project understanding

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

### Error Handling
- Custom error types: `ConfigValidationError`, `AIProviderError`
- Structured error classification with specific exit codes
- Comprehensive logging through `Logger` service

### Testing Strategy
When adding tests, use Jest framework. Test files should be in `**/*.test.ts` pattern (excluded from compilation).

### GitHub Action Specifics
- Action metadata in `action.yml` 
- Built artifact is `dist/index.js` (not `dist/main.js`)
- Requires Node 20 runtime
- Input validation through GitHub Actions core library