# React MCP (Model Context Protocol)

[![smithery badge](https://smithery.ai/badge/@Streen9/react-mcp)](https://smithery.ai/server/@Streen9/react-mcp)

A powerful server implementation that enables Claude AI to interact with React applications through the Model Context Protocol.

<a href="https://glama.ai/mcp/servers/xsjsdumc7x">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/xsjsdumc7x/badge" alt="https://github.com/Streen9/react-mcp MCP server" />
</a>

## Sample Usage

- [Markdown Editor/Viewer By Claude](https://claude.ai/share/f68940f1-97cd-41df-9c14-f63dc6fb9faf)
  ![image](https://github.com/user-attachments/assets/2f1087f5-006f-4d3f-a718-751267adafcc)

- [API Tester By Claude](https://claude.ai/share/b0b3943c-5c90-4b8d-8613-e76eaa243407)
  ![image](https://github.com/user-attachments/assets/dc627114-736e-4ca5-824b-cd084aa1813a)

## Overview

React MCP provides a bridge between Claude AI and the React ecosystem, allowing Claude to:

- Create new React applications
- Run React development servers
- Manage files and directories
- Install npm packages
- Execute terminal commands
- Track and manage long-running processes

This server implements the Model Context Protocol, providing Claude with the ability to perform real-world actions in the development environment.

## Features

- **React Project Management**

  - Create new React applications with optional templates
  - Run development servers
  - Manage dependencies

- **File Operations**

  - Read and write files
  - Edit React components and configuration

- **Process Management**

  - Start and monitor long-running processes
  - Track process output in real-time
  - Terminate processes when needed

- **Command Execution**

  - Run arbitrary terminal commands
  - Install npm packages
  - Execute development tasks

- **Comprehensive Logging**
  - Detailed JSON and text logs
  - Process tracking with timestamps
  - Execution history

## Installation

### Installing via Smithery

To install React MCP for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@Streen9/react-mcp):

```bash
npx -y @smithery/cli install @Streen9/react-mcp --client claude
```

### Manual Installation
1. Clone this repository
2. Install dependencies:

```bash
npm install
```

## Usage

Add this in `claude_desktop_config`:

```
{
  "mcpServers": {
    "react-mcp": {
      "command": "node",
      "args": [
        "C:/Users/kalip/OneDrive/Desktop/react-mcp/index.js"
      ]
    }
  }
}
```

The server runs on the stdio transport, allowing it to be used with Desktop Claude APP as a Model Context Protocol tool.

## Available Tools

### `create-react-app`

Creates a new React application.

Parameters:

- `name` (required): Name of the React app
- `template` (optional): Template to use (e.g., typescript, cra-template-pwa)
- `directory` (optional): Base directory to create the app in (defaults to home directory)

### `run-react-app`

Runs a React application in development mode.

Parameters:

- `projectPath` (required): Path to the React project folder

### `run-command`

Runs a terminal command.

Parameters:

- `command` (required): Command to execute
- `directory` (optional): Directory to run the command in (defaults to current directory)

### `get-process-output`

Gets the output from a running or completed process.

Parameters:

- `processId` (required): ID of the process to get output from

### `stop-process`

Stops a running process.

Parameters:

- `processId` (required): ID of the process to stop

### `list-processes`

Lists all currently running processes managed by the server.

Returns an array of process information including process ID, command, directory, running status, exit code, and runtime.

### `edit-file`

Creates or edits a file.

Parameters:

- `filePath` (required): Path to the file to edit
- `content` (required): Content to write to the file

### `read-file`

Reads the contents of a file.

Parameters:

- `filePath` (required): Path to the file to read

### `install-package`

Installs a npm package in a project.

Parameters:

- `packageName` (required): Name of the package to install (can include version)
- `directory` (optional): Directory of the project (defaults to current directory)
- `dev` (optional): Whether to install as a dev dependency

### `check-installation-status`

Checks the status of a package installation process.

Parameters:

- `processId` (required): ID of the installation process to check

### `batch-execute`

Executes multiple operations in a single request. This allows you to chain multiple tool calls together atomically, **reducing token usage and speeding up development** by eliminating the need for multiple back-and-forth conversations.

**Token & Performance Benefits:**
- **Reduces tokens**: Single request instead of multiple tool calls with repeated context
- **Faster development**: Eliminates network latency between sequential operations
- **Atomic execution**: All operations run in one go without intermediate prompts

Parameters:

- `operations` (required): Array of operations to execute, each with:
  - `name` (required): Name of the tool to call (e.g., "create-react-app", "run-command")
  - `arguments` (optional): Object containing the arguments for the tool

Returns:

- `message`: Summary message with the number of operations executed
- `operations`: Array of results for each operation, including success status and result/error
- `successCount`: Number of successful operations
- `failureCount`: Number of failed operations

## Logging

The server maintains detailed logs in the `logs` directory:

- `react-mcp-logs.json`: Structured JSON logs
- `react-mcp-logs.txt`: Human-readable text logs

## Architecture

The server uses the following key components:

- **Model Context Protocol SDK**: For communication with Claude AI
- **StdioServerTransport**: For I/O through standard input/output
- **Zod**: For schema validation and type safety
- **Child Process**: For spawning and managing external processes

## License

MIT

## Author

[@streen9](https://github.com/Streen9)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
