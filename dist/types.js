"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIProviderError = exports.ConfigValidationError = void 0;
// Error types
class ConfigValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ConfigValidationError";
    }
}
exports.ConfigValidationError = ConfigValidationError;
class AIProviderError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.name = "AIProviderError";
    }
}
exports.AIProviderError = AIProviderError;
//# sourceMappingURL=types.js.map