import { spawn } from "child_process";
import fs from "fs";
import path from "path";

// Keep track of running processes
export const runningProcesses = new Map();

// Start a long-running process and return its output stream
export function startProcess(command, args, cwd) {
  const childProcess = spawn(command, args, {
    cwd,
    shell: true,
    env: { ...process.env, FORCE_COLOR: "true" },
    stdio: ['pipe', 'pipe', 'pipe'] // Pipe stdin, stdout, stderr
  });

  // Handle errors during spawn itself (e.g., command not found)
  childProcess.on('error', (spawnError) => {
    console.error(`Error spawning process for command "${command}": ${spawnError.message}`);
    // This error will be difficult to propagate back to the specific handler call
    // that initiated this process, as startProcess returns synchronously.
    // The primary way to detect this failure from the handler's perspective
    // would be if the processId isn't found or if get-process-output shows immediate exit with error.
    // For now, we log it. A more robust solution might involve a callback or promise for startProcess.
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
