const fs = require("fs");
const yaml = require("js-yaml");
const core = require("@actions/core");

// Default configuration
const DEFAULT_CONFIG = {
  review_prompt: `ENHANCED CODE REVIEW PROMPT: Critical Analysis & Developer Assessment

CONTEXT: Today is ${
    new Date().toISOString().split("T")[0]
  }. Review with current best practices in mind.

MANDATORY FIRST STEP - IDENTIFY MOST CRITICAL ISSUE:
Priority 1: Functional failures (broken core functionality, data corruption risks, critical security vulnerabilities, memory leaks)
Priority 2: System stability (poor error handling, race conditions, performance bottlenecks)  
Priority 3: Maintainability blockers (architectural violations, tight coupling, code duplication)

Output format: "MOST CRITICAL ISSUE: [Category] - [Description]. IMPACT: [What breaks if unfixed]. IMMEDIATE ACTION: [Specific fix needed]."

EVALUATION FRAMEWORK:
- Functional Correctness: Requirements met, edge cases handled, input validation, boundary conditions
- Technical Implementation: Algorithm efficiency, architecture decisions, technology usage appropriately
- Code Quality: Readability (clear naming, formatting), documentation (explains why not just what), comprehensive error handling
- Testing & Reliability: Unit/integration tests, edge case coverage, proper mocking
- Security & Safety: Input sanitization, authentication checks, no hardcoded secrets

ANTIPATTERN DETECTION - Flag and educate on:
- God objects/functions (200+ line functions doing everything)
- Magic numbers/strings (use constants with descriptive names)
- Poor error handling (silent failures, swallowing exceptions)
- Tight coupling (changes requiring modifications across unrelated modules)
- Code duplication (repeated logic that should be abstracted)

COMMENT STRATEGY: Only add comments for genuinely critical issues that will impact functionality, security, or long-term maintainability. Skip minor style preferences unless they create real problems.`,
  max_comments: 8,
  prioritize_by_severity: true,
  review_aspects: [
    "bugs",
    "security_vulnerabilities",
    "performance_issues",
    "code_quality",
    "best_practices",
    "architecture_suggestions",
  ],
  ignore_patterns: [],
};

async function loadConfig(configFile) {
  let config = { ...DEFAULT_CONFIG };

  try {
    if (fs.existsSync(configFile)) {
      const fileContent = fs.readFileSync(configFile, "utf8");
      const userConfig = yaml.load(fileContent);
      config = { ...config, ...userConfig };
      core.info(`Loaded configuration from ${configFile}`);
    } else {
      core.info(`No config file found at ${configFile}, using defaults`);
    }
  } catch (error) {
    core.warning(
      `Failed to load config file: ${error.message}, using defaults`
    );
  }

  return config;
}

module.exports = { loadConfig, DEFAULT_CONFIG };
