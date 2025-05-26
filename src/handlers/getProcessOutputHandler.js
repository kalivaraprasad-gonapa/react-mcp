import { runningProcesses } from "../core/processManager.js";

export async function handleGetProcessOutput(params) {
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
