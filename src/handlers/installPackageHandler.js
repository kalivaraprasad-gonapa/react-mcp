import fs from "fs";
import path from "path";
import { startProcess } from "../core/processManager.js";

export async function handleInstallPackage(params) {
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
