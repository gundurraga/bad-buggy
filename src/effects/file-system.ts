import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { ReviewConfig } from '../types.js';

// Effect: Load configuration from file
export const loadConfigFromFile = async (configFile: string): Promise<ReviewConfig | null> => {
  try {
    if (!fs.existsSync(configFile)) {
      return null;
    }
    
    const configContent = fs.readFileSync(configFile, 'utf8');
    return yaml.load(configContent) as ReviewConfig;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load config file: ${message}`);
  }
};