import { runningProcesses } from "../core/processManager.js";

export async function handleStopProcess(params) {
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
