import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { logger } from "./utils/logger.js"; // Updated import
import {
  CreateReactAppSchema,
  RunReactAppSchema,
  RunCommandSchema,
  GetProcessOutputSchema,
  StopProcessSchema,
  EditFileSchema,
  ReadFileSchema,
  InstallPackageSchema,
} from "./schemas/toolSchemas.js";
import { handleCreateReactApp } from "./handlers/createReactAppHandler.js";
import { handleRunReactApp } from "./handlers/runReactAppHandler.js";
import { handleRunCommand } from "./handlers/runCommandHandler.js";
import { handleGetProcessOutput } from "./handlers/getProcessOutputHandler.js";
import { handleStopProcess } from "./handlers/stopProcessHandler.js";
import { handleListProcesses } from "./handlers/listProcessesHandler.js";
import { handleEditFile } from "./handlers/editFileHandler.js";
import { handleReadFile } from "./handlers/readFileHandler.js";
import { handleInstallPackage } from "./handlers/installPackageHandler.js";
import "./core/processManager.js"; // This ensures process cleanup listeners are attached

const createTextResponse = (text) => ({
  content: [{ type: "text", text }],
});

export function startServer() {
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
      ],
    };
    logger.info({ event: "list_tools", response }); // Use logger.info
    return response;
  });

  server.setRequestHandler(CallToolRequestSchema, async (request, context) => {
    const { name, arguments: args } = request.params;
    logger.info({ event: "call_tool", tool_name: name, args }); // Use logger.info, added tool_name for clarity

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
          throw new Error(`Unknown tool: ${name}`);
      }

      // If a handler returns an object with an 'error' key, treat it as a controlled error
      if (result && result.error) {
        logger.warn({ event: "tool_handler_error", tool_name: name, args, error: result.error }); // Use logger.warn
        // Ensure the error response is structured correctly for the client
        return createTextResponse(JSON.stringify({ error: result.error }, null, 2));
      }
      logger.debug({ event: "call_tool_success", tool_name: name, args, result }); // Add debug log for success
      return createTextResponse(JSON.stringify(result, null, 2));
    } catch (error) {
      // Logged the error with appropriate level
      const errorDetails = {
        event: "call_tool_error",
        tool_name: name,
        args,
        error: error.message,
        stack: error.stack,
      };
      if (error instanceof z.ZodError) {
        logger.warn(errorDetails); // ZodErrors are client/request errors, so WARN
        const formattedError = `Invalid arguments: ${error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", ")}`;
        return createTextResponse(JSON.stringify({ error: formattedError }, null, 2));
      } else if (error.message.startsWith("Unknown tool:")) {
        // Specific error for unknown tools
         return createTextResponse(JSON.stringify({ error: error.message }, null, 2));
      }
      // For other unexpected errors, return a generic message to the client
      return createTextResponse(JSON.stringify({ error: "An internal server error occurred." }, null, 2));
    }
  });

  const transport = new StdioServerTransport();
  server.connect(transport).then(() => {
    console.error("React MCP Server running on stdio");
  });

  // Global error handlers
  process.on('uncaughtException', (error) => {
    console.error('UNCAUGHT EXCEPTION:', error); // Keep console.error for immediate visibility
    logger.error({ event: "uncaughtException", error: error.message, stack: error.stack });
    // Optionally, attempt graceful shutdown or exit
    // process.exit(1); // Exit if the error is considered fatal
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason); // Keep console.error for immediate visibility
    // For 'reason', it might be an Error object or something else.
    const reasonMessage = reason instanceof Error ? reason.message : String(reason);
    const reasonStack = reason instanceof Error ? reason.stack : undefined;
    logger.error({ event: "unhandledRejection", reason: reasonMessage, stack: reasonStack, promise: promise });
    // Optionally, attempt graceful shutdown or exit
    // process.exit(1);
  });
}
