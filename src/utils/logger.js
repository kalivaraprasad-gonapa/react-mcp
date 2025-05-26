import fs from "fs";
import path from "path";
import { ABSOLUTE_LOG_DIR, LOG_LEVEL as CONFIGURED_LOG_LEVEL } from "../config.js";
import { shouldLog } from "./logLevels.js"; // Import the utility

// Initialize logging directory
if (!fs.existsSync(ABSOLUTE_LOG_DIR)) {
  fs.mkdirSync(ABSOLUTE_LOG_DIR, { recursive: true });
}

const getCurrentTimestamp = () => {
  return new Date().toISOString().replace(/[:.]/g, "-");
};

// Internal function to handle actual file writing
function writeLog(data, level = 'INFO') {
  // Check if this message level should be logged based on global config
  if (!shouldLog(level, CONFIGURED_LOG_LEVEL)) {
    return;
  }

  const timestamp = getCurrentTimestamp();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(), // Include level in log entry
    ...data,
  };

  // JSON logging
  const jsonLogPath = path.join(ABSOLUTE_LOG_DIR, "react-mcp-logs.json");
  let jsonLogs = [];
  try {
    if (fs.existsSync(jsonLogPath)) {
      const fileContent = fs.readFileSync(jsonLogPath, "utf8");
      jsonLogs = fileContent ? JSON.parse(fileContent) : [];
    }
    jsonLogs.push(logEntry);
    fs.writeFileSync(jsonLogPath, JSON.stringify(jsonLogs, null, 2));

    // Text logging
    const txtLogPath = path.join(ABSOLUTE_LOG_DIR, "react-mcp-logs.txt");
    // Add level to text log entry
    const txtLogEntry = `[${timestamp}] [${level.toUpperCase()}] ${JSON.stringify(data)}\n`;
    fs.appendFileSync(txtLogPath, txtLogEntry);
  } catch (error) {
    // Fallback to console.error if file logging fails
    console.error("Failed to write to log file:", error, "Original log data:", logEntry);
  }
}

// Exported logger object with level-specific methods
export const logger = {
  info: (data) => writeLog(data, 'INFO'),
  warn: (data) => writeLog(data, 'WARN'),
  error: (data) => writeLog(data, 'ERROR'),
  debug: (data) => writeLog(data, 'DEBUG'),
  // Keep original logToFile for compatibility or specific use cases if needed,
  // but encourage use of leveled methods.
  // This version of logToFile will also respect log levels.
  logToFile: (data, level = 'INFO') => writeLog(data, level),
};

// For direct compatibility with previous `logToFile` calls that might not have a level
// This will now also respect the configured log level.
export const logToFile = (data, level = 'INFO') => {
  // The 'type' parameter (json/text) is no longer used as both are always written.
  // The 'level' parameter is now the primary filtering mechanism.
  writeLog(data, level);
};
