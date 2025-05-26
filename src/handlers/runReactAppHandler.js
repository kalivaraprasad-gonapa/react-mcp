import fs from "fs";
import path from "path";
import { startProcess } from "../core/processManager.js";

export async function handleRunReactApp(params) {
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
