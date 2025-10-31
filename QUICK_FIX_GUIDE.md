# Quick Fix Guide - Priority Order

## 🔴 CRITICAL - Fix Immediately (Will Cause Failures)

### 1. Fix Process Output Race Condition (Lines 69-95)
**Current Code:**
```javascript
let output = "";
let errorOutput = "";

childProcess.stdout.on('data', (data) => {
  const chunk = data.toString();
  output += chunk;
});

childProcess.stderr.on('data', (data) => {
  const chunk = data.toString();
  errorOutput += chunk;
});

runningProcesses.set(processId, {
  process: childProcess,
  command,
  args,
  cwd,
  output,
  errorOutput,
  startTime: new Date(),
  processId,
});
```

**Fixed Code:**
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

const MAX_OUTPUT_SIZE = 1024 * 1024; // 1MB

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

// Add cleanup on exit
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

---

### 2. Fix Log File Memory Leak (Lines 31-47)
**Current Code:**
```javascript
const logToFile = (data, type = "json") => {
  const timestamp = getCurrentTimestamp();
  const logEntry = { timestamp, ...data };

  const jsonLogPath = path.join(LOG_DIR, "react-mcp-logs.json");
  let jsonLogs = [];
  if (fs.existsSync(jsonLogPath)) {
    const fileContent = fs.readFileSync(jsonLogPath, "utf8");
    jsonLogs = fileContent ? JSON.parse(fileContent) : [];
  }
  jsonLogs.push(logEntry);
  fs.writeFileSync(jsonLogPath, JSON.stringify(jsonLogs, null, 2));

  const txtLogPath = path.join(LOG_DIR, "react-mcp-logs.txt");
  const txtLogEntry = `[${timestamp}] ${JSON.stringify(data)}\n`;
  fs.appendFileSync(txtLogPath, txtLogEntry);
};
```

**Fixed Code:**
```javascript
const logToFile = (data, type = "json") => {
  const timestamp = getCurrentTimestamp();
  const logEntry = { timestamp, ...data };

  // JSON logging - use newline-delimited JSON
  const jsonLogPath = path.join(LOG_DIR, "react-mcp-logs.json");
  const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
  
  try {
    // Check if rotation needed
    if (fs.existsSync(jsonLogPath)) {
      const stats = fs.statSync(jsonLogPath);
      if (stats.size > MAX_LOG_SIZE) {
        fs.renameSync(jsonLogPath, `${jsonLogPath}.${Date.now()}.old`);
      }
    }
    
    // Append as newline-delimited JSON
    fs.appendFileSync(jsonLogPath, JSON.stringify(logEntry) + '\n');
  } catch (error) {
    console.error('Failed to write JSON log:', error);
  }

  // Text logging
  const txtLogPath = path.join(LOG_DIR, "react-mcp-logs.txt");
  const txtLogEntry = `[${timestamp}] ${JSON.stringify(data)}\n`;
  
  try {
    // Check if rotation needed
    if (fs.existsSync(txtLogPath)) {
      const stats = fs.statSync(txtLogPath);
      if (stats.size > MAX_LOG_SIZE) {
        fs.renameSync(txtLogPath, `${txtLogPath}.${Date.now()}.old`);
      }
    }
    
    fs.appendFileSync(txtLogPath, txtLogEntry);
  } catch (error) {
    console.error('Failed to write text log:', error);
  }
};
```

---

### 3. Fix Process ID Generation (Line 83)
**Current Code:**
```javascript
const processId = Math.random().toString(36).substring(2, 15);
```

**Fixed Code:**
```javascript
import { randomUUID } from 'crypto';

// In startProcess function:
const processId = randomUUID();
```

---

## 🟠 HIGH PRIORITY - Security Vulnerabilities

### 4. Add Input Validation for Commands
**Add at top of file:**
```javascript
// Allowed commands for run-command tool
const ALLOWED_COMMANDS = ['npm', 'node', 'git', 'ls', 'cat', 'pwd', 'echo', 'mkdir', 'cd'];

// Validate npm package name
function isValidPackageName(name) {
  const packageNameRegex = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(@[a-z0-9-._~]+)?$/i;
  return packageNameRegex.test(name);
}

// Validate project name
function isValidProjectName(name) {
  return /^[a-z0-9-_]+$/i.test(name);
}

// Validate template name
function isValidTemplateName(name) {
  return /^[a-z0-9-]+$/i.test(name);
}

// Validate file path is within allowed directory
function validateFilePath(filePath) {
  const resolvedPath = path.resolve(filePath);
  const allowedBase = path.resolve(os.homedir());
  
  if (!resolvedPath.startsWith(allowedBase)) {
    throw new Error('File path must be within user home directory');
  }
  
  // Block sensitive directories
  const sensitivePatterns = ['.ssh', '.aws', '.gnupg', '.config/gcloud'];
  for (const pattern of sensitivePatterns) {
    if (resolvedPath.includes(pattern)) {
      throw new Error(`Cannot access sensitive directory: ${pattern}`);
    }
  }
  
  return resolvedPath;
}
```

---

### 5. Fix handleCreateReactApp (Lines 100-140)
**Add validation at start:**
```javascript
async function handleCreateReactApp(params) {
  try {
    const { name, template, directory } = params;

    if (!name) {
      throw new Error("Project name is required");
    }
    
    // VALIDATE PROJECT NAME
    if (!isValidProjectName(name)) {
      throw new Error('Invalid project name. Only alphanumeric characters, hyphens, and underscores are allowed.');
    }
    
    // VALIDATE TEMPLATE
    if (template && !isValidTemplateName(template)) {
      throw new Error('Invalid template name. Only alphanumeric characters and hyphens are allowed.');
    }

    // Rest of function...
```

---

### 6. Fix handleRunCommand (Lines 185-215)
**Replace entire function:**
```javascript
async function handleRunCommand(params) {
  try {
    const { command, directory } = params;

    if (!command) {
      throw new Error("Command is required");
    }
    
    // VALIDATE COMMAND
    const commandParts = command.trim().split(/\s+/);
    const baseCommand = commandParts[0];
    
    if (!ALLOWED_COMMANDS.includes(baseCommand)) {
      throw new Error(
        `Command '${baseCommand}' is not allowed. ` +
        `Allowed commands: ${ALLOWED_COMMANDS.join(', ')}`
      );
    }

    // Determine directory
    const workingDir = directory || process.cwd();
    
    // VALIDATE DIRECTORY
    const resolvedDir = path.resolve(workingDir);
    const allowedBase = path.resolve(os.homedir());
    
    if (!resolvedDir.startsWith(allowedBase)) {
      throw new Error('Directory must be within user home directory');
    }

    // Check if directory exists
    if (!fs.existsSync(resolvedDir)) {
      throw new Error(`Directory ${resolvedDir} does not exist`);
    }

    // Run the command
    const result = await executeCommand(command, { cwd: resolvedDir });

    return {
      command: command,
      directory: resolvedDir,
      output: result.stdout,
      stderr: result.stderr || "",
    };
  } catch (error) {
    return {
      error: `Error executing command: ${error.message}`,
      stderr: error.stderr || "",
    };
  }
}
```

---

### 7. Fix handleEditFile (Lines 330-350)
**Add validation at start:**
```javascript
async function handleEditFile(params) {
  try {
    const { filePath, content } = params;

    if (!filePath) {
      throw new Error("File path is required");
    }

    if (content === undefined || content === null) {
      throw new Error("File content is required");
    }
    
    // VALIDATE FILE PATH
    const resolvedPath = validateFilePath(filePath);

    // Make sure directory exists
    const directory = path.dirname(resolvedPath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    // Write content to file
    fs.writeFileSync(resolvedPath, content, "utf8");

    return {
      message: `File ${resolvedPath} updated successfully`,
      filePath: resolvedPath,
      size: Buffer.byteLength(content, "utf8"),
    };
  } catch (error) {
    return {
      error: `Error editing file: ${error.message}`,
    };
  }
}
```

---

### 8. Fix handleReadFile (Lines 352-370)
**Add validation at start:**
```javascript
async function handleReadFile(params) {
  try {
    const { filePath } = params;

    if (!filePath) {
      throw new Error("File path is required");
    }
    
    // VALIDATE FILE PATH
    const resolvedPath = validateFilePath(filePath);

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File ${resolvedPath} does not exist`);
    }
    
    // CHECK FILE SIZE
    const stats = fs.statSync(resolvedPath);
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    
    if (stats.size > MAX_FILE_SIZE) {
      throw new Error(
        `File too large (${stats.size} bytes). Maximum size is ${MAX_FILE_SIZE} bytes.`
      );
    }

    // Read file content
    const content = fs.readFileSync(resolvedPath, "utf8");

    return {
      filePath: resolvedPath,
      content: content,
      size: Buffer.byteLength(content, "utf8"),
    };
  } catch (error) {
    return {
      error: `Error reading file: ${error.message}`,
    };
  }
}
```

---

### 9. Fix handleInstallPackage (Lines 372-410)
**Add validation at start:**
```javascript
async function handleInstallPackage(params) {
  try {
    const { packageName, directory, dev } = params;

    if (!packageName) {
      throw new Error("Package name is required");
    }
    
    // VALIDATE PACKAGE NAME
    if (!isValidPackageName(packageName)) {
      throw new Error('Invalid package name format');
    }

    // Rest of function...
```

---

### 10. Fix startProcess Shell Injection (Lines 64-66)
**Current Code:**
```javascript
const childProcess = spawn(command, args, {
  cwd,
  shell: true,
  env: { ...process.env, FORCE_COLOR: "true" },
});
```

**Fixed Code:**
```javascript
const childProcess = spawn(command, args, {
  cwd,
  shell: false,  // DISABLE SHELL INTERPRETATION
  env: { ...process.env, FORCE_COLOR: "true" },
});
```

**Note:** This might break some commands. If shell is needed, validate inputs strictly.

---

## 🟡 MEDIUM PRIORITY - Error Handling

### 11. Add Error Handling to JSON Parsing
**In logToFile function (lines 33-35):**
```javascript
try {
  const fileContent = fs.readFileSync(jsonLogPath, "utf8");
  jsonLogs = fileContent ? JSON.parse(fileContent) : [];
} catch (error) {
  console.error('Failed to parse log file, starting fresh:', error);
  jsonLogs = [];
  if (fs.existsSync(jsonLogPath)) {
    fs.renameSync(jsonLogPath, `${jsonLogPath}.corrupted.${Date.now()}`);
  }
}
```

**In handleRunReactApp (lines 168-170):**
```javascript
try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
} catch (error) {
  throw new Error(`Invalid package.json in ${projectPath}: ${error.message}`);
}
```

---

### 12. Fix handleStopProcess (Lines 270-290)
**Replace entire function:**
```javascript
async function handleStopProcess(params) {
  try {
    const { processId } = params;

    if (!processId) {
      throw new Error("Process ID is required");
    }

    if (!runningProcesses.has(processId)) {
      throw new Error(`Process with ID ${processId} not found`);
    }

    const processInfo = runningProcesses.get(processId);
    
    // Check if already exited
    if (processInfo.process.exitCode !== null) {
      return {
        message: `Process ${processId} has already exited`,
        exitCode: processInfo.process.exitCode,
        command: `${processInfo.command} ${processInfo.args.join(" ")}`,
        directory: processInfo.cwd,
      };
    }

    // Try graceful shutdown first
    try {
      processInfo.process.kill('SIGTERM');
      
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (processInfo.process.exitCode === null) {
          processInfo.process.kill('SIGKILL');
        }
      }, 5000);
      
    } catch (error) {
      throw new Error(`Failed to kill process: ${error.message}`);
    }

    return {
      message: `Process ${processId} stop signal sent`,
      command: `${processInfo.command} ${processInfo.args.join(" ")}`,
      directory: processInfo.cwd,
    };
  } catch (error) {
    return {
      error: `Error stopping process: ${error.message}`,
    };
  }
}
```

---

## 🟢 LOW PRIORITY - Quality Improvements

### 13. Improve Cleanup Handlers (Lines 656-672)
**Replace with:**
```javascript
function cleanup() {
  console.error('Cleaning up processes...');
  for (const [processId, processInfo] of runningProcesses.entries()) {
    try {
      processInfo.process.removeAllListeners();
      if (processInfo.process.exitCode === null) {
        processInfo.process.kill('SIGKILL');
      }
    } catch (error) {
      console.error(`Failed to kill process ${processId}:`, error);
    }
  }
  runningProcesses.clear();
}

process.on('exit', cleanup);

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});
```

---

## Testing After Fixes

### Test Process Output Capture
```javascript
// Create a process and check output is captured
const processId = await handleCreateReactApp({ name: 'test-app' });
await new Promise(resolve => setTimeout(resolve, 5000));
const output = await handleGetProcessOutput({ processId });
console.log('Output length:', output.output.length); // Should be > 0
```

### Test Log Rotation
```javascript
// Generate many log entries
for (let i = 0; i < 10000; i++) {
  logToFile({ test: 'data', iteration: i });
}
// Check log file size is limited
const stats = fs.statSync('logs/react-mcp-logs.json');
console.log('Log size:', stats.size); // Should be < 10MB
```

### Test Input Validation
```javascript
// Should throw errors
await handleRunCommand({ command: 'rm -rf /' }); // Not allowed
await handleEditFile({ filePath: '/etc/passwd', content: 'hack' }); // Outside home
await handleInstallPackage({ packageName: 'lodash; rm -rf /' }); // Invalid format
```

---

## Deployment Checklist

- [ ] All critical fixes applied
- [ ] All security fixes applied
- [ ] Input validation tested
- [ ] Memory leak fixes verified
- [ ] Process cleanup tested
- [ ] Log rotation working
- [ ] Error handling tested
- [ ] Security testing completed
- [ ] Load testing completed
- [ ] Documentation updated
