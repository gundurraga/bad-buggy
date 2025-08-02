import { Config } from '../types';

// Default configuration for Bad Buggy code review
export const DEFAULT_CONFIG: Config = {
  review_prompt: `You are an expert code reviewer. Please review the following code changes and provide constructive feedback.

Focus on:
- Code quality and best practices
- Potential bugs or issues
- Performance considerations
- Security concerns
- Maintainability and readability

Provide specific, actionable feedback with line numbers when applicable.`,
  max_comments: 8,
  ignore_patterns: [
    '*.lock',
    '*.log',
    'node_modules/**',
    'dist/**',
    'build/**',
    '*.min.js',
    '*.min.css'
  ],
  allowed_users: []
};