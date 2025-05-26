import fs from "fs";
import path from "path";

export async function handleEditFile(params) {
  try {
    const { filePath, content } = params;

    if (!filePath) {
      throw new Error("File path is required");
    }

    if (content === undefined || content === null) {
      throw new Error("File content is required");
    }

    // Make sure directory exists
    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    // Write content to file
    fs.writeFileSync(filePath, content, "utf8");

    return {
      message: `File ${filePath} updated successfully`,
      filePath: filePath,
      size: Buffer.byteLength(content, "utf8"),
    };
  } catch (error) {
    return {
      error: `Error editing file: ${error.message}`,
    };
  }
}
