import { ReviewConfig, ActionInputs, ValidationResult } from "./types";
export declare const DEFAULT_CONFIG: ReviewConfig;
export declare const mergeConfig: (defaultConfig: ReviewConfig, userConfig: Partial<ReviewConfig>) => ReviewConfig;
export declare const validateConfig: (config: ReviewConfig) => ValidationResult;
export declare const validateInputs: (inputs: ActionInputs) => ValidationResult;
export declare const validateAndThrow: (validation: ValidationResult, errorType: string) => void;
export declare const loadConfig: (configFile: string) => Promise<ReviewConfig>;
//# sourceMappingURL=config.d.ts.map