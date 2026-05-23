import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { spawn, exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

// Tool registry: centralized mapping of tool names to schemas and handlers
const toolRegistry = new Map();

// Line-based file editor helper
class LineEditor {
  constructor(content, lineEnding = '\n') {
    this.lines = content.split(/\r?\n/);
    this.lineEnding = lineEnding;
  }

  insertAtLine(lineIndex, newLines) {
    const newLineArray = Array.isArray(newLines) ? newLines : [newLines];
    this.lines.splice(lineIndex, 0, ...newLineArray);
    return this;
  }

  replaceAtLine(lineIndex, newLines) {
    const newLineArray = Array.isArray(newLines) ? newLines : [newLines];
    this.lines.splice(lineIndex, 1, ...newLineArray);
    return this;
  }

  findLine(pattern) {
    if (pattern instanceof RegExp && (pattern.global || pattern.sticky)) {
      pattern.lastIndex = 0;
    }
    return this.lines.findIndex(l => (pattern instanceof RegExp) ? pattern.test(l) : l.includes(pattern));
  }

  toString() {
    return this.lines.join(this.lineEnding);
  }
}

// Initialize logging
const LOG_DIR = "logs";
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR);
}

const getCurrentTimestamp = () => {
  return new Date().toISOString().replace(/[:.]/g, "-");
};

const logToFile = (data, type = "json") => {
  const timestamp = getCurrentTimestamp();
  const logEntry = {
    timestamp,
    ...data,
  };

  // JSON logging
  const jsonLogPath = path.join(LOG_DIR, "react-mcp-logs.json");
  let jsonLogs = [];
  if (fs.existsSync(jsonLogPath)) {
    const fileContent = fs.readFileSync(jsonLogPath, "utf8");
    jsonLogs = fileContent ? JSON.parse(fileContent) : [];
  }
  jsonLogs.push(logEntry);
  fs.writeFileSync(jsonLogPath, JSON.stringify(jsonLogs, null, 2));

  // Text logging
  const txtLogPath = path.join(LOG_DIR, "react-mcp-logs.txt");
  const txtLogEntry = `[${timestamp}] ${JSON.stringify(data)}\n`;
  fs.appendFileSync(txtLogPath, txtLogEntry);
};

// Keep track of running processes
const runningProcesses = new Map();

// Execute terminal commands
async function executeCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        return reject({ error, stderr });
      }
      resolve({ stdout, stderr });
    });
  });
}

// Start a long-running process and return its output stream
function startProcess(command, args, cwd) {
  const childProcess = spawn(command, args, {
    cwd,
    shell: true,
    env: { ...process.env, FORCE_COLOR: "true" },
  });

  let output = "";
  let errorOutput = "";

  childProcess.stdout.on("data", (data) => {
    const chunk = data.toString();
    output += chunk;
  });

  childProcess.stderr.on("data", (data) => {
    const chunk = data.toString();
    errorOutput += chunk;
  });

  const processId = Math.random().toString(36).substring(2, 15);

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

  return processId;
}

// Tool handlers
async function handleCreateReactApp(params) {
  try {
    const { name, template, directory } = params;

    if (!name) {
      throw new Error("Project name is required");
    }

    // Determine base directory
    const baseDir = directory || os.homedir();
    const projectDir = path.join(baseDir, name);

    // Check if directory already exists
    if (fs.existsSync(projectDir)) {
      throw new Error(`Directory ${projectDir} already exists`);
    }

    // Prepare create-react-app command
    const createCommand = template
      ? `npx create-react-app ${name} --template ${template}`
      : `npx create-react-app ${name}`;

    console.log(
      `Creating React app in ${baseDir} with command: ${createCommand}`
    );

    // Run the command
    const processId = startProcess(createCommand, [], baseDir);

    return {
      message: `Creating React app "${name}" in ${projectDir}`,
      processId: processId,
      projectDir: projectDir,
    };
  } catch (error) {
    return {
      error: `Error creating React app: ${error.message}`,
    };
  }
}

async function handleRunReactApp(params) {
  try {
    const { projectPath } = params;

    if (!projectPath) {
      throw new Error("Project path is required");
    }

    // Check if directory exists
    if (!fs.existsSync(projectPath)) {
      throw new Error(`Directory ${projectPath} does not exist`);
    }

    // Check if it's a React app (package.json exists with react dependency)
    const packageJsonPath = path.join(projectPath, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(
        `Not a valid React app: package.json not found in ${projectPath}`
      );
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    if (!packageJson.dependencies || !packageJson.dependencies.react) {
      throw new Error(
        `Not a valid React app: react dependency not found in package.json`
      );
    }

    // Start the development server
    const processId = startProcess("npm", ["start"], projectPath);

    return {
      message: `Starting React development server in ${projectPath}`,
      processId: processId,
      note: "The development server should be accessible at http://localhost:3000",
    };
  } catch (error) {
    return {
      error: `Error running React app: ${error.message}`,
    };
  }
}

async function handleRunCommand(params) {
  try {
    const { command, directory } = params;

    if (!command) {
      throw new Error("Command is required");
    }

    // Determine directory
    const workingDir = directory || process.cwd();

    // Check if directory exists
    if (!fs.existsSync(workingDir)) {
      throw new Error(`Directory ${workingDir} does not exist`);
    }

    // Run the command
    const result = await executeCommand(command, { cwd: workingDir });

    return {
      command: command,
      directory: workingDir,
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

async function handleGetProcessOutput(params) {
  try {
    const { processId } = params;

    if (!processId) {
      throw new Error("Process ID is required");
    }

    if (!runningProcesses.has(processId)) {
      throw new Error(`Process with ID ${processId} not found`);
    }

    const processInfo = runningProcesses.get(processId);
    const isRunning = processInfo.process.exitCode === null;

    return {
      processId: processId,
      command: `${processInfo.command} ${processInfo.args.join(" ")}`,
      directory: processInfo.cwd,
      isRunning: isRunning,
      exitCode: processInfo.process.exitCode,
      output: processInfo.output,
      errorOutput: processInfo.errorOutput,
      startTime: processInfo.startTime.toISOString(),
      runTime: `${Math.floor(
        (new Date() - processInfo.startTime) / 1000
      )} seconds`,
    };
  } catch (error) {
    return {
      error: `Error getting process output: ${error.message}`,
    };
  }
}

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

    // Kill the process
    processInfo.process.kill();

    return {
      message: `Process ${processId} stopped`,
      command: `${processInfo.command} ${processInfo.args.join(" ")}`,
      directory: processInfo.cwd,
    };
  } catch (error) {
    return {
      error: `Error stopping process: ${error.message}`,
    };
  }
}

async function handleListProcesses() {
  try {
    const processes = [];

    for (const [processId, processInfo] of runningProcesses.entries()) {
      const isRunning = processInfo.process.exitCode === null;

      processes.push({
        processId: processId,
        command: `${processInfo.command} ${processInfo.args.join(" ")}`,
        directory: processInfo.cwd,
        isRunning: isRunning,
        exitCode: processInfo.process.exitCode,
        startTime: processInfo.startTime.toISOString(),
        runTime: `${Math.floor(
          (new Date() - processInfo.startTime) / 1000
        )} seconds`,
      });
    }

    return {
      processes: processes,
      count: processes.length,
    };
  } catch (error) {
    return {
      error: `Error listing processes: ${error.message}`,
    };
  }
}

async function handleEditFile(params) {
  try {
    const { filePath, content } = params;

    if (!filePath) {
      throw new Error("File path is required");
    }

    if (content === undefined || content === null) {
      throw new Error("File content is required");
    }

    // Make sure directory exists
    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    // Write content to file
    fs.writeFileSync(filePath, content, "utf8");

    return {
      message: `File ${filePath} updated successfully`,
      filePath: filePath,
      size: Buffer.byteLength(content, "utf8"),
    };
  } catch (error) {
    return {
      error: `Error editing file: ${error.message}`,
    };
  }
}

async function handleReadFile(params) {
  try {
    const { filePath } = params;

    if (!filePath) {
      throw new Error("File path is required");
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File ${filePath} does not exist`);
    }

    // Read file content
    const content = fs.readFileSync(filePath, "utf8");

    return {
      filePath: filePath,
      content: content,
      size: Buffer.byteLength(content, "utf8"),
    };
  } catch (error) {
    return {
      error: `Error reading file: ${error.message}`,
    };
  }
}

async function handleInstallPackage(params) {
  try {
    const { packageName, directory, dev } = params;

    if (!packageName) {
      throw new Error("Package name is required");
    }

    // Determine directory
    const workingDir = directory || process.cwd();

    // Check if directory exists
    if (!fs.existsSync(workingDir)) {
      throw new Error(`Directory ${workingDir} does not exist`);
    }

    // Check if package.json exists
    const packageJsonPath = path.join(workingDir, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(
        `Not a valid Node.js project: package.json not found in ${workingDir}`
      );
    }

    // Install the package
    const installCommand = dev
      ? `npm install ${packageName} --save-dev`
      : `npm install ${packageName}`;

    const processId = startProcess(installCommand, [], workingDir);

    return {
      message: `Installing ${packageName} in ${workingDir}`,
      processId: processId,
      command: installCommand,
    };
  } catch (error) {
    return {
      error: `Error installing package: ${error.message}`,
    };
  }
}


async function handleBatchExecute(params) {
  try {
    const { operations } = params;

    if (!operations || !Array.isArray(operations)) {
      throw new Error("Operations array is required");
    }

    if (operations.length === 0) {
      throw new Error("At least one operation is required");
    }

    const results = [];

    for (const operation of operations) {
      const { name, arguments: args = {} } = operation;

      try {
        let result;

        switch (name) {
          case "create-react-app":
            const createArgs = CreateReactAppSchema.parse(args);
            result = await handleCreateReactApp(createArgs);
            break;
          case "run-react-app":
            const runArgs = RunReactAppSchema.parse(args);
            result = await handleRunReactApp(runArgs);
            break;
          case "run-command":
            const commandArgs = RunCommandSchema.parse(args);
            result = await handleRunCommand(commandArgs);
            break;
          case "get-process-output":
            const outputArgs = GetProcessOutputSchema.parse(args);
            result = await handleGetProcessOutput(outputArgs);
            break;
          case "stop-process":
            const stopArgs = StopProcessSchema.parse(args);
            result = await handleStopProcess(stopArgs);
            break;
          case "list-processes":
            result = await handleListProcesses();
            break;
          case "edit-file":
            const editArgs = EditFileSchema.parse(args);
            result = await handleEditFile(editArgs);
            break;
          case "read-file":
            const readArgs = ReadFileSchema.parse(args);
            result = await handleReadFile(readArgs);
            break;
          case "install-package":
            const installArgs = InstallPackageSchema.parse(args);
            result = await handleInstallPackage(installArgs);
            break;
          default:
            throw new Error("Unknown operation: " + name);
        }

        const hasError = result && typeof result === 'object' && 'error' in result;
        results.push({
          operation: name,
          success: !hasError,
          ...(hasError ? { error: result.error } : { result }),
        });
      } catch (error) {
        let errorMsg = error.message;
        if (error instanceof z.ZodError) {
          errorMsg = "Invalid arguments: " + error.errors.map(e => e.path.join(".") + ": " + e.message).join(", ");
        }
        const hasError = errorMsg && typeof errorMsg === 'object' && 'error' in errorMsg;
        results.push({
          operation: name,
          success: false,
          ...(hasError ? { error: errorMsg.error } : { error: errorMsg }),
        });
      }
    }

    return {
      message: "Executed " + results.length + " operations",
      operations: results,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
    };
  } catch (error) {
    return {
      error: "Error in batch execute: " + error.message,
    };
  }
}

// Server setup
const server = new Server(
  {
    name: "react-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define schemas
const CreateReactAppSchema = z.object({
  name: z.string(),
  template: z.string().optional(),
  directory: z.string().optional(),
});

const RunReactAppSchema = z.object({
  projectPath: z.string(),
});

const RunCommandSchema = z.object({
  command: z.string(),
  directory: z.string().optional(),
});

const GetProcessOutputSchema = z.object({
  processId: z.string(),
});

const StopProcessSchema = z.object({
  processId: z.string(),
});

const EditFileSchema = z.object({
  filePath: z.string(),
  content: z.string(),
});

const ReadFileSchema = z.object({
  filePath: z.string(),
});

const InstallPackageSchema = z.object({
  packageName: z.string(),
  directory: z.string().optional(),
  dev: z.boolean().optional(),
});


const BatchExecuteSchema = z.object({
  operations: z.array(
    z.object({
      name: z.string(),
      arguments: z.record(z.unknown()).optional(),
    })
  ),
});

// Register all tools in the central registry
toolRegistry.set("create-react-app", { schema: CreateReactAppSchema, handler: handleCreateReactApp });
toolRegistry.set("run-react-app", { schema: RunReactAppSchema, handler: handleRunReactApp });
toolRegistry.set("run-command", { schema: RunCommandSchema, handler: handleRunCommand });
toolRegistry.set("get-process-output", { schema: GetProcessOutputSchema, handler: handleGetProcessOutput });
toolRegistry.set("stop-process", { schema: StopProcessSchema, handler: handleStopProcess });
toolRegistry.set("list-processes", { schema: null, handler: handleListProcesses });
toolRegistry.set("edit-file", { schema: EditFileSchema, handler: handleEditFile });
toolRegistry.set("read-file", { schema: ReadFileSchema, handler: handleReadFile });
toolRegistry.set("install-package", { schema: InstallPackageSchema, handler: handleInstallPackage });
toolRegistry.set("batch-execute", { schema: BatchExecuteSchema, handler: handleBatchExecute });

// Tool request handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const response = {
    tools: [
      {
        name: "create-react-app",
        description: "Create a new React application",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the React app",
            },
            template: {
              type: "string",
              description:
                "Template to use (e.g., typescript, cra-template-pwa)",
            },
            directory: {
              type: "string",
              description:
                "Base directory to create the app in (defaults to home directory)",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "run-react-app",
        description: "Run a React application in development mode",
        inputSchema: {
          type: "object",
          properties: {
            projectPath: {
              type: "string",
              description: "Path to the React project folder",
            },
          },
          required: ["projectPath"],
        },
      },
      {
        name: "run-command",
        description: "Run a terminal command",
        inputSchema: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "Command to execute",
            },
            directory: {
              type: "string",
              description:
                "Directory to run the command in (defaults to current directory)",
            },
          },
          required: ["command"],
        },
      },
      {
        name: "get-process-output",
        description: "Get the output from a running or completed process",
        inputSchema: {
          type: "object",
          properties: {
            processId: {
              type: "string",
              description: "ID of the process to get output from",
            },
          },
          required: ["processId"],
        },
      },
      {
        name: "stop-process",
        description: "Stop a running process",
        inputSchema: {
          type: "object",
          properties: {
            processId: {
              type: "string",
              description: "ID of the process to stop",
            },
          },
          required: ["processId"],
        },
      },
      {
        name: "list-processes",
        description: "List all running processes",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "edit-file",
        description: "Create or edit a file",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the file to edit",
            },
            content: {
              type: "string",
              description: "Content to write to the file",
            },
          },
          required: ["filePath", "content"],
        },
      },
      {
        name: "read-file",
        description: "Read the contents of a file",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the file to read",
            },
          },
          required: ["filePath"],
        },
      },
      {
        name: "install-package",
        description: "Install a npm package in a project",
        inputSchema: {
          type: "object",
          properties: {
            packageName: {
              type: "string",
              description:
                "Name of the package to install (can include version)",
            },
            directory: {
              type: "string",
              description:
                "Directory of the project (defaults to current directory)",
            },
            dev: {
              type: "boolean",
              description: "Whether to install as a dev dependency",
            },
          },
          required: ["packageName"],
        },
      },
      {
        name: "batch-execute",
        description: "Execute multiple operations in a single request",
        inputSchema: {
          type: "object",
          properties: {
            operations: {
              type: "array",
              description: "Array of operations to execute",
              items: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "Name of the tool to call",
                  },
                  arguments: {
                    type: "object",
                    description: "Arguments to pass to the tool",
                    additionalProperties: true,
                  },
                },
                required: ["name"],
              },
            },
          },
          required: ["operations"],
        },
      },
    ],
  };
  logToFile({ event: "list_tools", response }, "json");
  return response;
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request, context) => {
  const { name, arguments: args } = request.params;
  logToFile({ event: "call_tool", name, args }, "json");

  try {
    let result;

    switch (name) {
      case "create-react-app":
        const createArgs = CreateReactAppSchema.parse(args);
        result = await handleCreateReactApp(createArgs);
        break;

      case "run-react-app":
        const runArgs = RunReactAppSchema.parse(args);
        result = await handleRunReactApp(runArgs);
        break;

      case "run-command":
        const commandArgs = RunCommandSchema.parse(args);
        result = await handleRunCommand(commandArgs);
        break;

      case "get-process-output":
        const outputArgs = GetProcessOutputSchema.parse(args);
        result = await handleGetProcessOutput(outputArgs);
        break;

      case "stop-process":
        const stopArgs = StopProcessSchema.parse(args);
        result = await handleStopProcess(stopArgs);
        break;

      case "list-processes":
        result = await handleListProcesses();
        break;

      case "edit-file":
        const editArgs = EditFileSchema.parse(args);
        result = await handleEditFile(editArgs);
        break;

      case "read-file":
        const readArgs = ReadFileSchema.parse(args);
        result = await handleReadFile(readArgs);
        break;

      case "install-package":
        const installArgs = InstallPackageSchema.parse(args);
        result = await handleInstallPackage(installArgs);
        break;

      case "batch-execute":
        const batchArgs = BatchExecuteSchema.parse(args);
        result = await handleBatchExecute(batchArgs);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return createTextResponse(JSON.stringify(result, null, 2));
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid arguments: ${error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", ")}`
      );
    }
    throw error;
  }
});

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("React MCP Server running on stdio");

const createTextResponse = (text) => ({
  content: [{ type: "text", text }],
});

// Clean up processes on exit
process.on("exit", () => {
  for (const [processId, processInfo] of runningProcesses.entries()) {
    try {
      processInfo.process.kill();
    } catch (error) {
      console.error(`Failed to kill process ${processId}:`, error);
    }
  }
});

process.on("SIGINT", () => {
  process.exit(0);
});

process.on("SIGTERM", () => {
  process.exit(0);
});
