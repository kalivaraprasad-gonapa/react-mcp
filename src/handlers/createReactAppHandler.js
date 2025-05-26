import fs from "fs";
import path from "path";
import os from "os";
import { startProcess } from "../core/processManager.js";

export async function handleCreateReactApp(params) {
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
