"use strict";
// Application constants - centralized magic numbers for better maintainability
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROVIDER_URLS = exports.PROVIDER_FORMATS = exports.ERROR_MESSAGES = exports.REVIEW_CONSTANTS = void 0;
exports.REVIEW_CONSTANTS = {
    // Chunking and content limits
    MAX_CHUNK_SIZE: 60000,
    CONTEXT_LINES: 100,
    SMALL_FILE_THRESHOLD: 200,
    FUNCTION_SEARCH_RANGE: 50,
    // Token estimation
    DEFAULT_CHARS_PER_TOKEN: 3.5,
    CLAUDE_CHARS_PER_TOKEN: 3.8,
    GPT4_CHARS_PER_TOKEN: 3.2,
    // API limits
    MAX_TOKENS: 128000, // Modern models have 128k+ context windows
    MAX_FILES_PER_REQUEST: 100,
    // Retry configuration
    MAX_RETRIES: 2,
    RETRY_DELAY_MS: 1000,
    // Security audit
    MAX_ACCESS_LOG_ENTRIES: 100,
    // File processing
    MAX_DISPLAY_FILES: 10,
    MIN_API_KEY_LENGTH: 20,
};
exports.ERROR_MESSAGES = {
    NO_API_KEY: "API key not found for provider",
    INVALID_API_KEY_FORMAT: "Invalid API key format for provider",
    PERMISSION_CHECK_FAILED: "Permission check failed - cannot verify authorization",
    SECURITY_CHECK_ERROR: "Security check error",
    USERS_READ_ONLY: "Users cannot be modified through GitHub API",
    USERS_CANNOT_DELETE: "Users cannot be deleted through GitHub API",
    UNSUPPORTED_PROVIDER: "Unsupported AI provider",
};
exports.PROVIDER_FORMATS = {
    anthropic: "sk-ant-... (starts with sk-ant-)",
    openrouter: "sk-or-... (starts with sk-or-)",
};
exports.PROVIDER_URLS = {
    anthropic: "https://console.anthropic.com/settings/keys",
    openrouter: "https://openrouter.ai/settings/keys",
};
//# sourceMappingURL=constants.js.map