import { runningProcesses } from "../core/processManager.js";

export async function handleListProcesses() {
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
