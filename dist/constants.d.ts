export declare const REVIEW_CONSTANTS: {
    readonly MAX_CHUNK_SIZE: 60000;
    readonly CONTEXT_LINES: 100;
    readonly SMALL_FILE_THRESHOLD: 200;
    readonly FUNCTION_SEARCH_RANGE: 50;
    readonly DEFAULT_CHARS_PER_TOKEN: 3.5;
    readonly CLAUDE_CHARS_PER_TOKEN: 3.8;
    readonly GPT4_CHARS_PER_TOKEN: 3.2;
    readonly MAX_TOKENS: 128000;
    readonly MAX_FILES_PER_REQUEST: 100;
    readonly MAX_RETRIES: 2;
    readonly RETRY_DELAY_MS: 1000;
    readonly MAX_ACCESS_LOG_ENTRIES: 100;
    readonly MAX_DISPLAY_FILES: 10;
    readonly MIN_API_KEY_LENGTH: 20;
};
export declare const ERROR_MESSAGES: {
    readonly NO_API_KEY: "API key not found for provider";
    readonly INVALID_API_KEY_FORMAT: "Invalid API key format for provider";
    readonly PERMISSION_CHECK_FAILED: "Permission check failed - cannot verify authorization";
    readonly SECURITY_CHECK_ERROR: "Security check error";
    readonly USERS_READ_ONLY: "Users cannot be modified through GitHub API";
    readonly USERS_CANNOT_DELETE: "Users cannot be deleted through GitHub API";
    readonly UNSUPPORTED_PROVIDER: "Unsupported AI provider";
};
export declare const PROVIDER_FORMATS: {
    readonly anthropic: "sk-ant-... (starts with sk-ant-)";
    readonly openrouter: "sk-or-... (starts with sk-or-)";
};
export declare const PROVIDER_URLS: {
    readonly anthropic: "https://console.anthropic.com/settings/keys";
    readonly openrouter: "https://openrouter.ai/settings/keys";
};
//# sourceMappingURL=constants.d.ts.map