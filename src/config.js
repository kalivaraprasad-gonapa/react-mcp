import path from 'path';
import os from 'os';

// Define LOG_DIR, reading from environment variable or using a default
export const LOG_DIR = process.env.REACT_MCP_LOG_DIR || 'logs';

// Resolve LOG_DIR to an absolute path. This is generally good practice for directory configurations.
export const ABSOLUTE_LOG_DIR = path.resolve(LOG_DIR);

// Define LOG_LEVEL, reading from environment variable or using a default from logLevels.js
import { DEFAULT_LOG_LEVEL, LOG_LEVELS } from './utils/logLevels.js';
const rawLogLevel = (process.env.REACT_MCP_LOG_LEVEL || DEFAULT_LOG_LEVEL).toUpperCase();
export const LOG_LEVEL = LOG_LEVELS[rawLogLevel] ? rawLogLevel : DEFAULT_LOG_LEVEL;


// Example for other potential configurations (not implementing these now, just for illustration)
// export const DEFAULT_PROJECT_DIR = process.env.REACT_MCP_DEFAULT_PROJECT_DIR || os.homedir();
// export const ALLOWED_RUN_COMMAND_BASE_DIRS = (
//   process.env.REACT_MCP_ALLOWED_BASE_DIRS || `${process.cwd()},${os.homedir()}`
// ).split(',').map(p => path.resolve(p.trim()));
// export const COMMAND_DENYLIST_PATTERNS = (
//   process.env.REACT_MCP_COMMAND_DENYLIST || 
//   "^(sudo\\s+)?rm\\s+-rf\\s+(\\/|\\/\\*|~\\/|~\\/\\*),^mkfs,^dd\\s+,^fdisk,^gdisk,^parted,^userdel,^groupdel,^(shutdown|reboot|halt|poweroff)(\\s+|$)"
// ).split(',').map(p => p.trim());

// Note: For complex configurations like COMMAND_DENYLIST_PATTERNS, consider a dedicated config file
// (JSON, YAML) if environment variables become too cumbersome.
// For now, only LOG_DIR is being actively externalized.
