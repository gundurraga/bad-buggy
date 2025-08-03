"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = void 0;
// Default configuration for Bad Buggy code review
exports.DEFAULT_CONFIG = {
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
//# sourceMappingURL=default-config.js.map