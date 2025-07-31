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
exports.ConfigValidationError = void 0;
exports.validateConfig = validateConfig;
exports.validateInputs = validateInputs;
const core = __importStar(require("@actions/core"));
class ConfigValidationError extends Error {
    constructor(message, field) {
        super(message);
        this.name = 'ConfigValidationError';
        this.field = field;
    }
}
exports.ConfigValidationError = ConfigValidationError;
function validateConfig(config) {
    const errors = [];
    // Validate required fields
    if (!config.review_prompt ||
        typeof config.review_prompt !== 'string' ||
        config.review_prompt.trim() === '') {
        errors.push('review_prompt must be a non-empty string');
    }
    if (typeof config.max_comments !== 'number' || config.max_comments < 1) {
        errors.push('max_comments must be a positive number');
    }
    if (typeof config.prioritize_by_severity !== 'boolean') {
        errors.push('prioritize_by_severity must be a boolean');
    }
    // Validate review_aspects
    if (!Array.isArray(config.review_aspects)) {
        errors.push('review_aspects must be an array');
    }
    // Validate ignore_patterns
    if (!Array.isArray(config.ignore_patterns)) {
        errors.push('ignore_patterns must be an array');
    }
    // Validate allowed_users
    if (!Array.isArray(config.allowed_users)) {
        errors.push('allowed_users must be an array');
    }
    // Validate ranges
    if (config.max_comments > 20) {
        core.warning('max_comments is very high (>20), this may result in high costs');
    }
    if (config.review_prompt.length > 10000) {
        core.warning('review_prompt is very long (>10k chars), this may result in high token costs');
    }
    if (errors.length > 0) {
        throw new ConfigValidationError(`Configuration validation failed:\n${errors.join('\n')}`, 'config');
    }
    return config;
}
function validateInputs(inputs) {
    const { githubToken, aiProvider, apiKey, model } = inputs;
    const errors = [];
    if (!githubToken) {
        errors.push('github-token is required');
    }
    else if (!githubToken.match(/^(ghp_|ghs_|github_pat_)/)) {
        errors.push('github-token must be a valid GitHub token (starts with ghp_, ghs_, or github_pat_)');
    }
    if (!aiProvider) {
        errors.push('ai-provider is required');
    }
    else if (!['anthropic', 'openrouter'].includes(aiProvider)) {
        errors.push("ai-provider must be 'anthropic' or 'openrouter'");
    }
    if (!apiKey) {
        errors.push('api-key is required');
    }
    else {
        // Basic API key format validation
        if (aiProvider === 'anthropic' && !apiKey.startsWith('sk-ant-')) {
            errors.push("Anthropic API key should start with 'sk-ant-'");
        }
        else if (aiProvider === 'openrouter' && !apiKey.startsWith('sk-or-')) {
            errors.push("OpenRouter API key should start with 'sk-or-'");
        }
        else if (apiKey.length < 20) {
            errors.push('API key seems too short to be valid');
        }
    }
    if (!model) {
        errors.push('model is required');
    }
    if (errors.length > 0) {
        throw new ConfigValidationError(`Input validation failed:\n${errors.join('\n')}`, 'inputs');
    }
    return inputs;
}
//# sourceMappingURL=config-validator.js.map