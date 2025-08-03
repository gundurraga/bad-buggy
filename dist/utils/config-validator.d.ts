import { Config } from "../types";
export declare class ConfigValidationError extends Error {
    readonly field: string;
    constructor(message: string, field: string);
}
interface ValidationInputs {
    githubToken: string;
    aiProvider: string;
    apiKey: string;
    model: string;
}
export declare function validateConfig(config: Config): Config;
export declare function validateInputs(inputs: ValidationInputs): ValidationInputs;
export {};
//# sourceMappingURL=config-validator.d.ts.map