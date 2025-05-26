import fs from "fs";
import path from "path";
import os from "os";
import { executeCommand } from "../core/commandExecutor.js";

// Regex to detect common shell metacharacters used for command chaining/injection
const DANGEROUS_SHELL_CHARS_REGEX = /[;&|`$()<>]/;
// Removed '\n', '\r' as they might be part of legitimate multi-line commands if we were to support them,
// but for now, we assume single-line commands. '<' and '>' are for redirection.

// Denylist of dangerous command patterns
// These regexes aim to catch common dangerous commands.
// They are not exhaustive and might need refinement.
const COMMAND_DENYLIST = [
  /^sudo\s+rm\s+-rf\s+(\/|\/\*|~\/|\~\/\*)/i, // sudo rm -rf / or /* or ~/ or ~/*
  /^rm\s+-rf\s+(\/|\/\*|~\/|\~\/\*)/i, // rm -rf / or /* or ~/ or ~/*
  /^mkfs/i, // mkfs (any variant)
  /^dd\s+/i, // dd command, especially if targeting block devices
  /^fdisk/i, // fdisk
  /^gdisk/i, // gdisk
  /^parted/i, // parted
  /^userdel/i, // userdel
  /^groupdel/i, // groupdel
  // /^chmod\s+.*000/i, // chmod to 000 - This might be too broad or complex to get right without more context
  // /^chown\s+root/i, // chown to root - Also potentially too broad, depends on target
  /^(shutdown|reboot|halt|poweroff)(\s+|$)/i, // system shutdown/reboot commands
  // Add more specific patterns as needed, e.g., for specific critical file manipulations
  // Example: /^:\s*\(.*\)\s*\{.*\};/i, // fork bombs like :( ){ :|:& };:
  // Example: /^mv\s+.*\s+\/dev\/null/i, // Moving important files to /dev/null
];

export async function handleRunCommand(params) {
  try {
    const { command, directory } = params;

    if (!command) {
      throw new Error("Command is required");
    }

    // Security: Prevent command chaining and dangerous characters
    if (DANGEROUS_SHELL_CHARS_REGEX.test(command)) {
      throw new Error(
        "Command contains disallowed shell metacharacters. Only single commands without chaining (e.g., ;, &&, ||, |, $, `) or redirection (<, >) are allowed."
      );
    }

    // Security: Check against command denylist
    // We test the command as is, and also a version where the first word (command) is lowercased
    // to make the initial command keyword check case-insensitive.
    const commandParts = command.trim().split(/\s+/);
    const firstCommandWordLower = commandParts[0].toLowerCase();
    const commandForDenylistCheck = [firstCommandWordLower, ...commandParts.slice(1)].join(" ");

    for (const pattern of COMMAND_DENYLIST) {
      if (pattern.test(commandForDenylistCheck)) { // Test against the modified command string
        throw new Error("Command is forbidden by security policy.");
      }
    }

    // Determine and validate working directory
    let workingDir = directory;
    if (!workingDir) {
      workingDir = process.cwd();
    } else {
      // Security: Path traversal validation
      const resolvedPath = path.resolve(workingDir);
      const projectRoot = process.cwd();
      const homeDir = os.homedir();

      // Check if the resolved path is within the project root or user's home directory
      if (
        !resolvedPath.startsWith(projectRoot) &&
        !resolvedPath.startsWith(homeDir)
      ) {
        throw new Error(
          `Specified directory '${workingDir}' is outside allowed paths (project root or home directory).`
        );
      }
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Specified directory ${resolvedPath} does not exist`);
      }
      workingDir = resolvedPath; // Use the resolved, validated path
    }

    // Check if directory exists (redundant if resolvedPath check is done, but good for clarity if logic changes)
    if (!fs.existsSync(workingDir)) {
      throw new Error(`Directory ${workingDir} does not exist`);
    }

    // Run the command
    const result = await executeCommand(command, { cwd: workingDir });

    return {
      command: command,
      directory: workingDir,
      output: result.stdout,
      stderr: result.stderr || "",
    };
  } catch (error) {
    // If 'error' is the object { error: ErrorObject, stderr: string } from executeCommand
    if (error && error.error && error.error instanceof Error) {
      return {
        error: `Error executing command: ${error.error.message}`,
        stderr: error.stderr || "",
      };
    }
    // Otherwise, it's likely an error thrown directly by this handler (e.g., new Error("..."))
    return {
      error: `Error executing command: ${error.message}`,
      stderr: "", // No specific stderr in this case
    };
  }
}
