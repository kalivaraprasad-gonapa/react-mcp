import fs from "fs";

export async function handleReadFile(params) {
  try {
    const { filePath } = params;

    if (!filePath) {
      throw new Error("File path is required");
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File ${filePath} does not exist`);
    }

    // Read file content
    const content = fs.readFileSync(filePath, "utf8");

    return {
      filePath: filePath,
      content: content,
      size: Buffer.byteLength(content, "utf8"),
    };
  } catch (error) {
    return {
      error: `Error reading file: ${error.message}`,
    };
  }
}
