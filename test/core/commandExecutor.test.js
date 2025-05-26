import { jest } from '@jest/globals';

// Mock child_process
const mockExec = jest.fn();
jest.unstable_mockModule('child_process', () => ({
  exec: mockExec,
}));

const { executeCommand } = await import('../../src/core/commandExecutor.js');

describe('Core - commandExecutor', () => {
  afterEach(() => {
    mockExec.mockReset();
  });

  it('should call exec with the correct command and options', async () => {
    const command = 'ls -la';
    const options = { cwd: '/test' };
    mockExec.mockImplementation((cmd, opts, callback) => {
      callback(null, 'stdout data', ''); // Simulate successful execution
      return { on: jest.fn() }; // Mock the child process object if needed
    });

    await executeCommand(command, options);
    expect(mockExec).toHaveBeenCalledWith(command, options, expect.any(Function));
  });

  it('should resolve with stdout and stderr on successful execution', async () => {
    const command = 'echo "hello"';
    const expectedStdout = 'hello\n';
    const expectedStderr = '';
    mockExec.mockImplementation((cmd, opts, callback) => {
      callback(null, expectedStdout, expectedStderr);
      return { on: jest.fn() };
    });

    const result = await executeCommand(command);
    expect(result).toEqual({ stdout: expectedStdout, stderr: expectedStderr });
  });

  it('should reject with error and stderr on failed execution', async () => {
    const command = 'invalid_command';
    const expectedError = new Error('Command failed');
    const expectedStderr = 'Error: command not found';
    mockExec.mockImplementation((cmd, opts, callback) => {
      callback(expectedError, '', expectedStderr);
      return { on: jest.fn() };
    });

    try {
      await executeCommand(command);
    } catch (e) {
      expect(e).toEqual({ error: expectedError, stderr: expectedStderr });
    }
  });
  
  it('should handle exec returning only an error object', async () => {
    const command = 'another_failed_command';
    const expectedError = new Error('Something went very wrong');
    // Some errors might not provide distinct stdout/stderr, just an error object.
    mockExec.mockImplementation((cmd, opts, callback) => {
      callback(expectedError, null, null); // Simulate error with null stdout/stderr
      return { on: jest.fn() };
    });

    try {
      await executeCommand(command);
    } catch (e) {
      // Ensure the stderr property exists, even if null, for consistency
      expect(e).toEqual({ error: expectedError, stderr: null });
    }
  });
});
