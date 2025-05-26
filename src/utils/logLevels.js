// Defines the log levels and their severity order.
// Higher number means higher severity.
export const LOG_LEVELS = {
  ERROR: 3,
  WARN: 2,
  INFO: 1,
  DEBUG: 0,
};

// Default log level if not specified or invalid
export const DEFAULT_LOG_LEVEL = 'INFO';

/**
 * Checks if a message at a given level should be logged based on the configured minimum level.
 * @param {string} messageLevel The level of the message to be logged (e.g., 'INFO', 'DEBUG').
 * @param {string} configuredMinLevel The minimum level configured for logging (e.g., 'INFO').
 * @returns {boolean} True if the message should be logged, false otherwise.
 */
export function shouldLog(messageLevel, configuredMinLevel) {
  const msgLevelNum = LOG_LEVELS[messageLevel.toUpperCase()];
  const confMinLevelNum = LOG_LEVELS[configuredMinLevel.toUpperCase()];

  // If either level is undefined (invalid), default to not logging for safety,
  // or handle as per desired strictness. Here, we'll be permissive for unknown message levels
  // if the configured level is very low (like DEBUG), but strict if configured level is high.
  if (msgLevelNum === undefined) {
    return false; // Do not log if the message's level is unknown
  }
  if (confMinLevelNum === undefined) {
    // If configured level is unknown, default it to INFO's numeric value for comparison
    return msgLevelNum >= LOG_LEVELS[DEFAULT_LOG_LEVEL];
  }

  return msgLevelNum >= confMinLevelNum;
}
