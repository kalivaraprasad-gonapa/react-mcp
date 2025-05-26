import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// Store original env
const originalEnv = { ...process.env };

// Set a specific log directory for tests via environment variable, which config.js will pick up
process.env.REACT_MCP_LOG_DIR = '/tmp/test_logs_mcp_react';
// Default test log level, can be overridden in specific describe blocks
process.env.REACT_MCP_LOG_LEVEL = 'DEBUG';


// Define the expected log directory based on the mocked env var for use in tests
const EXPECTED_TEST_LOG_DIR = path.resolve('/tmp/test_logs_mcp_react');

let logger; 
let logToFileFunction; 

describe('Logger Utilities', () => {
  const MOCK_DATE = new Date('2023-10-27T10:00:00.000Z');
  const EXPECTED_TIMESTAMP_PREFIX = '2023-10-27T10-00-00-000Z';

  beforeAll(() => {
    jest.useFakeTimers('modern');
    jest.setSystemTime(MOCK_DATE);

    // Global spies on fs methods that will be configured per test or describe block
    jest.spyOn(fs, 'existsSync');
    jest.spyOn(fs, 'mkdirSync');
    jest.spyOn(fs, 'readFileSync');
    jest.spyOn(fs, 'writeFileSync');
    jest.spyOn(fs, 'appendFileSync');
    jest.spyOn(console, 'error').mockImplementation(() => {}); // Global console.error spy
  });

  afterAll(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    process.env = originalEnv; 
  });

  beforeEach(async () => {
    // Reset all mock implementations and call history before each test
    fs.existsSync.mockReset().mockImplementation(() => false); // Default to not existing
    fs.mkdirSync.mockReset();
    fs.readFileSync.mockReset().mockReturnValue('');
    fs.writeFileSync.mockReset();
    fs.appendFileSync.mockReset();
    console.error.mockClear();
    
    jest.resetModules(); // Crucial: reset module cache before each import
    const loggerModule = await import('../../src/utils/logger.js');
    logger = loggerModule.logger;
    logToFileFunction = loggerModule.logToFile;
  });


  describe('Log Directory Initialization', () => {
    it('should create log directory if it does not exist WHEN MODULE IS LOADED', () => {
      // beforeEach already calls resetModules and imports, which triggers initialization.
      // fs.existsSync is mocked to return false in beforeEach.
      expect(fs.mkdirSync).toHaveBeenCalledWith(EXPECTED_TEST_LOG_DIR, { recursive: true });
    });
  });

  describe('logToFile Functionality (process.env.REACT_MCP_LOG_LEVEL is DEBUG for these tests)', () => {
    const testData = { message: 'Test log entry' };
    const expectedJsonLogPath = path.join(EXPECTED_TEST_LOG_DIR, 'react-mcp-logs.json');
    const expectedTxtLogPath = path.join(EXPECTED_TEST_LOG_DIR, 'react-mcp-logs.txt');
    
    beforeEach(() => {
      // For these tests, the log directory and JSON log file should "exist"
      // The directory itself is created by the module initialization logic tested above.
      fs.existsSync.mockImplementation(p => {
        if (p === EXPECTED_TEST_LOG_DIR) return true;
        if (p === expectedJsonLogPath) return true;
        return false;
      });
    });

    it('should write JSON log with correct content, timestamp, and level INFO', () => {
      logger.info(testData); 
      const expectedLogEntry = {
        timestamp: EXPECTED_TIMESTAMP_PREFIX,
        level: 'INFO',
        ...testData,
      };
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expectedJsonLogPath,
        JSON.stringify([expectedLogEntry], null, 2)
      );
    });
    
    it('should write JSON log with correct content, timestamp, and level ERROR', () => {
      logger.error(testData); 
      const expectedLogEntry = {
        timestamp: EXPECTED_TIMESTAMP_PREFIX,
        level: 'ERROR',
        ...testData,
      };
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expectedJsonLogPath,
        JSON.stringify([expectedLogEntry], null, 2)
      );
    });

    it('should append text log with correct content, timestamp, and level WARN', () => {
      logger.warn(testData); 
      const expectedTxtEntry = `[${EXPECTED_TIMESTAMP_PREFIX}] [WARN] ${JSON.stringify(testData)}\n`;
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        expectedTxtLogPath,
        expectedTxtEntry
      );
    });

    it('should handle existing JSON logs and append new entry (using direct logToFile with DEBUG level)', () => {
        const existingLogData = [{ timestamp: 'old-timestamp', level: 'INFO', message: 'Old log' }];
        
        // Specific mocks for this test case:
        // The outer beforeEach has already reset modules and imported logToFileFunction.
        // process.env.REACT_MCP_LOG_LEVEL is 'DEBUG' at this point.
        fs.existsSync.mockImplementation(p => {
            if (p === expectedJsonLogPath) return true; 
            if (p === EXPECTED_TEST_LOG_DIR) return true; 
            return false;
        });
        fs.readFileSync.mockReturnValue(JSON.stringify(existingLogData));
        
        logToFileFunction(testData, 'DEBUG'); // Call with DEBUG level
        
        const newLogEntry = {
            timestamp: EXPECTED_TIMESTAMP_PREFIX,
            level: 'DEBUG',
            ...testData,
        };
        const expectedFullLog = [...existingLogData, newLogEntry];
        expect(fs.writeFileSync).toHaveBeenCalledWith(
            expectedJsonLogPath,
            JSON.stringify(expectedFullLog, null, 2)
        );
    });

    it('should call console.error if logging fails', () => {
        fs.writeFileSync.mockImplementationOnce(() => { // Mocking failure for writeFileSync
            throw new Error('Disk full');
        });
        
        logger.error({ message: 'Error log test data' }); 

        expect(console.error).toHaveBeenCalledWith(
            'Failed to write to log file:',
            expect.any(Error), 
            'Original log data:',
            expect.objectContaining({ 
                level: 'ERROR',
                message: 'Error log test data',
                timestamp: EXPECTED_TIMESTAMP_PREFIX
            })
        );
    });
  });

  describe('Log Level Filtering', () => {
    const testData = { message: 'Test for filtering' };

    const setupFilteringTest = async (configuredLevel) => {
      process.env.REACT_MCP_LOG_LEVEL = configuredLevel;
      jest.resetModules();
      const loggerModule = await import('../../src/utils/logger.js');
      // Ensure fs mocks are clean for this specific logger instance
      fs.writeFileSync.mockClear();
      fs.appendFileSync.mockClear();
      // For logs to be written, the log directory must be seen as existing.
      fs.existsSync.mockImplementation(p => p === EXPECTED_TEST_LOG_DIR || p.endsWith('.json'));
      return loggerModule.logger;
    };

    it('should NOT log DEBUG messages if CONFIGURED_LOG_LEVEL is INFO', async () => {
      const infoLogger = await setupFilteringTest('INFO');
      infoLogger.debug(testData);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(fs.appendFileSync).not.toHaveBeenCalled();
    });

    it('should log INFO messages if CONFIGURED_LOG_LEVEL is INFO', async () => {
      const infoLogger = await setupFilteringTest('INFO');
      infoLogger.info(testData);
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(fs.appendFileSync).toHaveBeenCalled();
    });

    it('should log WARN messages if CONFIGURED_LOG_LEVEL is INFO', async () => {
      const infoLogger = await setupFilteringTest('INFO');
      infoLogger.warn(testData);
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(fs.appendFileSync).toHaveBeenCalled();
    });

    it('should NOT log INFO messages if CONFIGURED_LOG_LEVEL is ERROR', async () => {
      const errorLogger = await setupFilteringTest('ERROR');
      errorLogger.info(testData);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(fs.appendFileSync).not.toHaveBeenCalled();
    });

    it('should log ERROR messages if CONFIGURED_LOG_LEVEL is ERROR', async () => {
      const errorLogger = await setupFilteringTest('ERROR');
      errorLogger.error(testData);
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(fs.appendFileSync).toHaveBeenCalled();
    });
  });
});
