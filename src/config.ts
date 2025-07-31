import { ReviewConfig, ActionInputs } from './types';
import { loadConfigFromFile } from './effects/file-system';

// Default configuration
export const DEFAULT_CONFIG: ReviewConfig = {
  review_prompt: `You are an expert code reviewer. Your task is to review the provided code changes and identify issues.

MANDATORY FIRST STEP: Identify the single most critical issue in this code. This must be one of:
- Functional failures (bugs, logic errors, incorrect behavior)
- System stability issues (memory leaks, performance problems, crashes)
- Maintainability blockers (code that will be impossible to maintain or extend)

Output this as: **CRITICAL ISSUE: [brief description]**

EVALUATION FRAMEWORK:
1. **Functional Correctness**: Does the code work as intended?
2. **Technical Implementation**: Is the approach sound and efficient?
3. **Code Quality**: Is it readable, maintainable, and well-structured?
4. **Testing & Reliability**: Are edge cases handled? Is it testable?
5. **Security & Safety**: Are there security vulnerabilities or unsafe practices?

ANTIPATTERN DETECTION:
- God objects/functions doing too much
- Magic numbers and hardcoded values
- Poor error handling or silent failures
- Tight coupling between components
- Code duplication

COMMENT STRATEGY:
Focus on critical issues that could cause:
- Production failures
- Security vulnerabilities
- Major maintainability problems
- Performance degradation

For each issue found, provide:
**File:** [filename]
**Line:** [line number]
**Severity:** [critical/major/minor/info]
**Comment:** [detailed explanation with suggested fix]

Prioritize critical and major issues. Avoid nitpicking minor style issues unless they impact functionality.`,
  max_comments: 5,
  prioritize_by_severity: true,
  review_aspects: [
    'bugs',
    'security',
    'performance',
    'maintainability',
    'testing',
    'documentation'
  ],
  ignore_patterns: [
    '*.md',
    '*.txt',
    '*.json',
    'package-lock.json',
    'yarn.lock',
    '*.log'
  ],
  allowed_users: []
};

// Pure function to merge configurations
export const mergeConfig = (defaultConfig: ReviewConfig, userConfig: Partial<ReviewConfig>): ReviewConfig => {
  return {
    ...defaultConfig,
    ...userConfig
  };
};

// Effect: Load and merge configuration
export const loadConfig = async (configFile: string): Promise<ReviewConfig> => {
  const userConfig = await loadConfigFromFile(configFile);
  return userConfig ? mergeConfig(DEFAULT_CONFIG, userConfig) : DEFAULT_CONFIG;
};