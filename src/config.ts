import { ReviewConfig, ActionInputs } from './types';
import { loadConfigFromFile } from './effects/file-system';
import { DEFAULT_CONFIG } from './config/default-config';

// Re-export the default configuration
export { DEFAULT_CONFIG };

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