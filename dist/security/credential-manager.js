"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CredentialManager = void 0;
const core = __importStar(require("@actions/core"));
const constants_1 = require("../constants");
/**
 * Secure credential management service
 * Handles API key validation, access control, and secure storage
 */
class CredentialManager {
    constructor() {
        this.credentials = new Map();
        this.accessLog = [];
    }
    static getInstance() {
        if (!CredentialManager.instance) {
            CredentialManager.instance = new CredentialManager();
        }
        return CredentialManager.instance;
    }
    /**
     * Securely retrieve API key for a provider
     * @param provider The AI provider name
     * @returns The API key if valid and authorized
     */
    getApiKey(provider) {
        this.logAccess(provider, "retrieve");
        const key = this.credentials.get(provider) || this.getFromEnvironment(provider);
        if (!key) {
            throw new Error(`❌ ${constants_1.ERROR_MESSAGES.NO_API_KEY}: ${provider}\n\n` +
                `🔧 Fix: Add your API key as a repository secret:\n` +
                `1. Go to Settings → Secrets and variables → Actions\n` +
                `2. Add: ${this.getExpectedSecretName(provider)}\n` +
                `3. Get your key from: ${this.getProviderUrl(provider)}\n\n` +
                `💡 Make sure the secret name matches exactly (case-sensitive)`);
        }
        if (!this.validateApiKey(key, provider)) {
            throw new Error(`❌ ${constants_1.ERROR_MESSAGES.INVALID_API_KEY_FORMAT}: ${provider}\n\n` +
                `Expected format: ${this.getExpectedFormat(provider)}\n` +
                `Received format: ${key.substring(0, 10)}...\n\n` +
                `🔧 Fix: Get a valid API key from: ${this.getProviderUrl(provider)}`);
        }
        return key;
    }
    /**
     * Securely store API key for a provider
     * @param provider The AI provider name
     * @param apiKey The API key to store
     */
    setApiKey(provider, apiKey) {
        if (!this.validateApiKey(apiKey, provider)) {
            throw new Error(`❌ ${constants_1.ERROR_MESSAGES.INVALID_API_KEY_FORMAT}: ${provider}\n\n` +
                `Expected format: ${this.getExpectedFormat(provider)}\n` +
                `🔧 Fix: Get a valid API key from: ${this.getProviderUrl(provider)}`);
        }
        this.credentials.set(provider, apiKey);
        this.logAccess(provider, "store");
    }
    /**
     * Validate API key format based on provider
     * @param apiKey The API key to validate
     * @param provider The provider name
     * @returns True if valid format
     */
    validateApiKey(apiKey, provider) {
        if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
            return false;
        }
        // Provider-specific validation
        switch (provider.toLowerCase()) {
            case "anthropic":
                return (apiKey.startsWith("sk-ant-") &&
                    apiKey.length > constants_1.REVIEW_CONSTANTS.MIN_API_KEY_LENGTH);
            case "openrouter":
                return (apiKey.startsWith("sk-or-") &&
                    apiKey.length > constants_1.REVIEW_CONSTANTS.MIN_API_KEY_LENGTH);
            default:
                // Generic validation for unknown providers
                return apiKey.length > 10;
        }
    }
    /**
     * Get API key from environment variables
     * @param provider The provider name
     * @returns The API key from environment
     */
    getFromEnvironment(provider) {
        const envVarNames = {
            anthropic: ["ANTHROPIC_API_KEY"],
            openrouter: ["OPENROUTER_API_KEY"],
        };
        const possibleNames = envVarNames[provider.toLowerCase()] || [`${provider.toUpperCase()}_API_KEY`];
        for (const envVar of possibleNames) {
            const value = process.env[envVar] ||
                core.getInput(envVar.toLowerCase().replace("_", "-"));
            if (value) {
                return value;
            }
        }
        return undefined;
    }
    /**
     * Log access attempts for security auditing
     * @param provider The provider name
     * @param action The action performed
     */
    logAccess(provider, action) {
        this.accessLog.push({
            provider,
            timestamp: new Date(),
            action,
        });
        // Keep only last entries to prevent memory leaks
        if (this.accessLog.length > constants_1.REVIEW_CONSTANTS.MAX_ACCESS_LOG_ENTRIES) {
            this.accessLog = this.accessLog.slice(-constants_1.REVIEW_CONSTANTS.MAX_ACCESS_LOG_ENTRIES);
        }
        core.debug(`Credential access: ${provider} - ${action}`);
    }
    /**
     * Clear all stored credentials (for security)
     */
    clearCredentials() {
        this.credentials.clear();
        this.logAccess("system", "clear_all");
    }
    /**
     * Get access log for security auditing
     * @returns Array of access log entries
     */
    getAccessLog() {
        return [...this.accessLog]; // Return copy to prevent modification
    }
    /**
     * Check if API key exists for provider
     * @param provider The provider name
     * @returns True if key exists
     */
    hasApiKey(provider) {
        return (this.credentials.has(provider) || !!this.getFromEnvironment(provider));
    }
    /**
     * Get expected secret name for provider
     * @param provider The provider name
     * @returns Expected GitHub secret name
     */
    getExpectedSecretName(provider) {
        const secretNames = {
            anthropic: "ANTHROPIC_API_KEY",
            openrouter: "OPENROUTER_API_KEY",
        };
        return (secretNames[provider.toLowerCase()] ||
            `${provider.toUpperCase()}_API_KEY`);
    }
    /**
     * Get provider URL for getting API keys
     * @param provider The provider name
     * @returns URL where users can get API keys
     */
    getProviderUrl(provider) {
        return (constants_1.PROVIDER_URLS[provider.toLowerCase()] ||
            `https://${provider.toLowerCase()}.com`);
    }
    /**
     * Get expected API key format for provider
     * @param provider The provider name
     * @returns Expected format description
     */
    getExpectedFormat(provider) {
        return (constants_1.PROVIDER_FORMATS[provider.toLowerCase()] || "Valid API key format");
    }
}
exports.CredentialManager = CredentialManager;
//# sourceMappingURL=credential-manager.js.map