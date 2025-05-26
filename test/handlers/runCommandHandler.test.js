import { jest } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Mock dependencies
const mockExecuteCommand = jest.fn();
jest.unstable_mockModule('../../src/core/commandExecutor.js', () => ({
  executeCommand: mockExecuteCommand,
}));

// Mock fs and os, path is generally not mocked unless specific path manipulations need to be controlled.
jest.spyOn(fs, 'existsSync');
jest.spyOn(os, 'homedir');

const { handleRunCommand } = await import('../../src/handlers/runCommandHandler.js');

describe('Handlers - runCommandHandler', () => {
  const originalCwd = process.cwd();
  const mockHomeDir = '/mock/home';

  beforeEach(() => {
    mockExecuteCommand.mockReset();
    fs.existsSync.mockReset();
    os.homedir.mockReset();

    // Default mocks
    os.homedir.mockReturnValue(mockHomeDir);
    fs.existsSync.mockReturnValue(true); // Assume directory exists by default
    mockExecuteCommand.mockResolvedValue({ stdout: 'Success', stderr: '' });
  });

  afterAll(() => {
    jest.restoreAllMocks(); // Clean up all spies
  });

  it('should execute a valid command in the current directory by default', async () => {
    const params = { command: 'ls -la' };
    const response = await handleRunCommand(params);

    expect(mockExecuteCommand).toHaveBeenCalledWith(params.command, { cwd: originalCwd });
    expect(response.output).toBe('Success');
    expect(response.error).toBeUndefined();
  });

  it('should execute a valid command in a specified, allowed directory (project root child)', async () => {
    const projectSubDir = path.join(originalCwd, 'subdir');
    fs.existsSync.mockImplementation((p) => p === projectSubDir || p === originalCwd); 
    
    const params = { command: 'npm test', directory: projectSubDir };
    const response = await handleRunCommand(params);

    expect(mockExecuteCommand).toHaveBeenCalledWith(params.command, { cwd: projectSubDir });
    expect(response.output).toBe('Success');
  });

  it('should execute a valid command in a specified, allowed directory (home dir child)', async () => {
    const homeSubDir = path.join(mockHomeDir, 'projects');
    fs.existsSync.mockImplementation((p) => p === homeSubDir || p === mockHomeDir);
    
    const params = { command: 'git status', directory: homeSubDir };
    const response = await handleRunCommand(params);
    
    expect(mockExecuteCommand).toHaveBeenCalledWith(params.command, { cwd: homeSubDir });
    expect(response.output).toBe('Success');
  });

  it('should return an error if command is missing', async () => {
    const params = { command: '' };
    const response = await handleRunCommand(params);
    expect(response.error).toBe('Error executing command: Command is required');
    expect(mockExecuteCommand).not.toHaveBeenCalled();
  });

  it('should return an error for commands with disallowed shell metacharacters', async () => {
    const params = { command: 'ls && rm -rf /' };
    const response = await handleRunCommand(params);
    expect(response.error).toContain('Command contains disallowed shell metacharacters');
    expect(mockExecuteCommand).not.toHaveBeenCalled();
  });

  it('should return an error for commands in the denylist', async () => {
    const params = { command: 'sudo rm -rf /' };
    const response = await handleRunCommand(params);
    expect(response.error).toBe('Error executing command: Command is forbidden by security policy.');
    expect(mockExecuteCommand).not.toHaveBeenCalled();
  });
  
  it('should return an error for denylisted command with different casing (e.g. RM)', async () => {
    const params = { command: 'RM -rf /' }; // Uppercase RM
    const response = await handleRunCommand(params);
    expect(response.error).toBe('Error executing command: Command is forbidden by security policy.');
    expect(mockExecuteCommand).not.toHaveBeenCalled();
  });

  it('should return "outside allowed paths" error for a non-existent directory that is also outside allowed roots', async () => {
    const nonExistentOutsideDir = '/arbitrary/nonexistent/path';
    // This path, when resolved, will be checked against projectRoot and homeDir.
    // fs.existsSync for path.resolve(nonExistentOutsideDir) is implicitly false by default mock,
    // but the "outside allowed paths" error should trigger first.
    fs.existsSync.mockImplementation(p => {
      // Make sure projectRoot and homeDir are seen as existing for the check
      if (p === originalCwd) return true;
      if (p === mockHomeDir) return true;
      // The nonExistentOutsideDir itself does not exist
      if (p === path.resolve(nonExistentOutsideDir)) return false;
      return false; // Default for any other path
    });

    const params = { command: 'ls', directory: nonExistentOutsideDir };
    const response = await handleRunCommand(params);

    expect(response.error).toContain(`Specified directory '${nonExistentOutsideDir}' is outside allowed paths`);
    expect(mockExecuteCommand).not.toHaveBeenCalled();
  });

  it('should return "does not exist" error for a non-existent directory WITHIN allowed roots', async () => {
    const nonExistentButAllowedParentDir = path.join(mockHomeDir, 'projectX'); // e.g. /mock/home/projectX
    fs.existsSync.mockImplementation(p => {
        const resolvedPath = path.resolve(nonExistentButAllowedParentDir);
        if (p === resolvedPath) return false; // projectX itself does not exist
        if (p === mockHomeDir) return true; // home directory exists
        if (p === originalCwd) return true; // project root exists
        return false; // Default for other paths
    });

    const params = { command: 'ls', directory: nonExistentButAllowedParentDir };
    const response = await handleRunCommand(params);
    const resolvedPath = path.resolve(nonExistentButAllowedParentDir);
    expect(response.error).toBe(`Error executing command: Specified directory ${resolvedPath} does not exist`);
    expect(mockExecuteCommand).not.toHaveBeenCalled();
  });

  it('should return an error for path traversal outside allowed directories (for an existing dir)', async () => {
    const outsideDir = '/etc'; // Assuming /etc is not under originalCwd or mockHomeDir
    fs.existsSync.mockImplementation((p) => {
        if (p === path.resolve(outsideDir)) return true; // /etc exists
        if (p === originalCwd) return true;
        if (p === mockHomeDir) return true;
        return false;
    });

    const params = { command: 'cat passwd', directory: outsideDir };
    const response = await handleRunCommand(params);

    expect(response.error).toContain(`Specified directory '${outsideDir}' is outside allowed paths`);
    expect(mockExecuteCommand).not.toHaveBeenCalled();
  });
  
  it('should handle absolute path for directory within allowed zones correctly', async () => {
    const absoluteAllowedDir = path.resolve(originalCwd, 'allowed_sub');
    fs.existsSync.mockImplementation((p) => p === absoluteAllowedDir || p === originalCwd);

    const params = { command: 'ls', directory: absoluteAllowedDir };
    await handleRunCommand(params);
    expect(mockExecuteCommand).toHaveBeenCalledWith(params.command, { cwd: absoluteAllowedDir });
  });

  it('should return error from executeCommand if command execution fails', async () => {
    const executionErrorObj = new Error('Execution failed');
    const executionStderr = 'Command not found';
    // This is what executeCommand rejects with: { error: ErrorObject, stderr: string }
    mockExecuteCommand.mockRejectedValue({ error: executionErrorObj, stderr: executionStderr }); 
    
    const params = { command: 'some_failing_command' };
    const response = await handleRunCommand(params);

    // The handler formats the error like this: `Error executing command: ${error.error.message}`
    expect(response.error).toBe(`Error executing command: ${executionErrorObj.message}`);
    expect(response.stderr).toBe(executionStderr);
  });
});
