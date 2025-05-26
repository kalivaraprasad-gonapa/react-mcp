import { exec } from "child_process";

// Execute terminal commands
export async function executeCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        return reject({ error, stderr });
      }
      resolve({ stdout, stderr });
    });
  });
}
