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

## Architecture

The server is structured with a modular design within the `src` directory:
- `src/core`: Core functionalities like command execution and process management.
- `src/handlers`: Request handlers for each tool/capability.
- `src/utils`: Utility functions, including the logger and log level definitions.
- `src/schemas`: Zod schemas for request validation.
- `src/config.js`: Centralized configuration management, primarily through environment variables.
- `src/server.js`: Main server setup, request routing, and global error handling.
- `index.js`: The main entry point that starts the server.

The application uses the Model Context Protocol SDK for communication, Zod for schema validation, and Node.js child processes for executing external commands.

## Installation

### Installing via Smithery

To install React MCP for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@Streen9/react-mcp):

```bash
npx -y @smithery/cli install @Streen9/react-mcp --client claude
```

### Manual Installation
1. Clone this repository:
   ```bash
   git clone https://github.com/Streen9/react-mcp.git
   cd react-mcp
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. To run tests:
   ```bash
   npm test
   ```

## Usage

Add this in `claude_desktop_config.jsonc` (or similar configuration file for your MCP client):

```jsonc
{
  "mcpServers": {
    "react-mcp": {
      "command": "node",
      "args": [
        // Update this path to where you cloned react-mcp/index.js
        "C:/path/to/your/cloned/react-mcp/index.js" 
      ]
    }
  }
}
```

The server runs on the stdio transport, allowing it to be used with Desktop Claude App or other MCP-compatible clients.

## Configuration

The server can be configured using the following environment variables:

- `REACT_MCP_LOG_DIR`: Specifies the directory where log files are stored.
  - Default: `logs` (relative to the application root)
- `REACT_MCP_LOG_LEVEL`: Controls the verbosity of the logs.
  - Supported levels: `ERROR`, `WARN`, `INFO`, `DEBUG`.
  - Default: `INFO`

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

*Note: Security measures are in place, including prevention of command chaining, path traversal restrictions, and a denylist for certain potentially dangerous commands.*

### `get-process-output`

Gets the output from a running or completed process.

Parameters:

- `processId` (required): ID of the process to get output from

### `stop-process`

Stops a running process.

Parameters:

- `processId` (required): ID of the process to stop

### `list-processes`

Lists all running processes.

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
This tool was mentioned in the old README but does not have a corresponding handler in the current codebase. It might have been removed or planned. (Note: This tool is likely deprecated or was never fully implemented as no handler exists in the provided code.)

## Logging

The server maintains detailed logs:

- `react-mcp-logs.json`: Structured JSON logs.
- `react-mcp-logs.txt`: Human-readable text logs.

The log directory can be configured via the `REACT_MCP_LOG_DIR` environment variable (defaults to `logs`).
Log verbosity is configurable via the `REACT_MCP_LOG_LEVEL` environment variable (defaults to `INFO`).

## Docker

The provided `Dockerfile` is optimized for production:
- Uses a specific Node.js LTS version (`node:20-alpine`).
- Runs the application as a non-root user (`appuser`) for enhanced security.
- Includes a `.dockerignore` file to ensure a lean build context and smaller image size.
- Omits development dependencies from the final image.

To build the Docker image:
```bash
docker build -t react-mcp .
```

To run the Docker image (example, replace `/path/to/host/logs` with your desired log path if you want logs outside the container):
```bash
# Example for running and mounting a log volume
docker run -i --rm \
  -e REACT_MCP_LOG_DIR="/app/logs" \
  -e REACT_MCP_LOG_LEVEL="DEBUG" \
  -v /path/to/host/logs:/app/logs \
  react-mcp
```
Note: For the stdio server, interactive mode (`-i` or `-it`) along with `--rm` for cleanup is usually recommended when running via `docker run`.

## License

MIT

## Author

[@streen9](https://github.com/Streen9)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
When adding new features or fixing bugs, please ensure to add or update relevant tests. Tests can be run using:
```bash
npm test
```
