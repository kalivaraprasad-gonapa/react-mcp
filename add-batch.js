import fs from "fs";

// Line-based file editor helper
class LineEditor {
  constructor(content, lineEnding = '\n') {
    this.lines = content.split(/\r?\n/);
    this.lineEnding = lineEnding;
  }

  insertAtLine(lineIndex, newLines) {
    const newLineArray = Array.isArray(newLines) ? newLines : [newLines];
    this.lines.splice(lineIndex, 0, ...newLineArray);
    return this;
  }

  replaceAtLine(lineIndex, newLines) {
    const newLineArray = Array.isArray(newLines) ? newLines : [newLines];
    this.lines.splice(lineIndex, 1, ...newLineArray);
    return this;
  }

  findLine(pattern) {
    return this.lines.findIndex(l => pattern.test ? pattern.test(l) : l.includes(pattern));
  }

  toString() {
    return this.lines.join(this.lineEnding);
  }
}

// Detect line ending
function detectLineEnding(content) {
  if (content.includes('\r\n')) return '\r\n';
  if (content.includes('\n')) return '\n';
  return '\n';
}

const filePath = "index.js";
let content = fs.readFileSync(filePath, "utf8");
const lineEnding = detectLineEnding(content);
const editor = new LineEditor(content, lineEnding);

// Find switch default case by line
const defaultLineIdx = editor.lines.findIndex((l, i) => 
  l.trim() === 'default:' && editor.lines[i+1]?.includes('Unknown tool:')
);
if (defaultLineIdx === -1) throw new Error('Main default case not found');

editor.insertAtLine(defaultLineIdx, [
  '      case "batch-execute":',
  '        const batchArgs = BatchExecuteSchema.parse(args);',
  '        result = await handleBatchExecute(batchArgs);',
  '        break;'
]);

// Find end of handleInstallPackage function
let installFuncEnd = -1;
for (let i = 0; i < editor.lines.length; i++) {
  if (editor.lines[i].includes('async function handleInstallPackage')) {
    let braceCount = 0;
    let inFunction = false;
    for (let j = i; j < editor.lines.length; j++) {
      if (editor.lines[j].includes('{')) {
        braceCount++;
        inFunction = true;
      }
      if (editor.lines[j].includes('}')) {
        braceCount--;
        if (inFunction && braceCount === 0) {
          installFuncEnd = j + 1;
          break;
        }
      }
    }
    break;
  }
}
if (installFuncEnd === -1) throw new Error('handleInstallPackage end not found');

const handlerLines = [
  '',
  'async function handleBatchExecute(params) {',
  '  try {',
  '    const { operations } = params;',
  '',
  '    if (!operations || !Array.isArray(operations)) {',
  '      throw new Error("Operations array is required");',
  '    }',
  '',
  '    if (operations.length === 0) {',
  '      throw new Error("At least one operation is required");',
  '    }',
  '',
  '    const results = [];',
  '',
  '    for (const operation of operations) {',
  '      const { name, arguments: args = {} } = operation;',
  '',
  '      try {',
  '        let result;',
  '',
  '        switch (name) {',
  '          case "create-react-app":',
  '            const createArgs = CreateReactAppSchema.parse(args);',
  '            result = await handleCreateReactApp(createArgs);',
  '            break;',
  '          case "run-react-app":',
  '            const runArgs = RunReactAppSchema.parse(args);',
  '            result = await handleRunReactApp(runArgs);',
  '            break;',
  '          case "run-command":',
  '            const commandArgs = RunCommandSchema.parse(args);',
  '            result = await handleRunCommand(commandArgs);',
  '            break;',
  '          case "get-process-output":',
  '            const outputArgs = GetProcessOutputSchema.parse(args);',
  '            result = await handleGetProcessOutput(outputArgs);',
  '            break;',
  '          case "stop-process":',
  '            const stopArgs = StopProcessSchema.parse(args);',
  '            result = await handleStopProcess(stopArgs);',
  '            break;',
  '          case "list-processes":',
  '            result = await handleListProcesses();',
  '            break;',
  '          case "edit-file":',
  '            const editArgs = EditFileSchema.parse(args);',
  '            result = await handleEditFile(editArgs);',
  '            break;',
  '          case "read-file":',
  '            const readArgs = ReadFileSchema.parse(args);',
  '            result = await handleReadFile(readArgs);',
  '            break;',
  '          case "install-package":',
  '            const installArgs = InstallPackageSchema.parse(args);',
  '            result = await handleInstallPackage(installArgs);',
  '            break;',
  '          default:',
  '            throw new Error("Unknown operation: " + name);',
  '        }',
  '',
  '        results.push({',
  '          operation: name,',
  '          success: true,',
  '          result,',
  '        });',
  '      } catch (error) {',
  '        let errorMsg = error.message;',
  '        if (error instanceof z.ZodError) {',
  '          errorMsg = "Invalid arguments: " + error.errors.map(e => e.path.join(".") + ": " + e.message).join(", ");',
  '        }',
  '        results.push({',
  '          operation: name,',
  '          success: false,',
  '          error: errorMsg,',
  '        });',
  '      }',
  '    }',
  '',
  '    return {',
  '      message: "Executed " + results.length + " operations",',
  '      operations: results,',
  '      successCount: results.filter(r => r.success).length,',
  '      failureCount: results.filter(r => !r.success).length,',
  '    };',
  '  } catch (error) {',
  '    return {',
  '      error: "Error in batch execute: " + error.message,',
  '    };',
  '  }',
  '}',
  ''
];
editor.insertAtLine(installFuncEnd, handlerLines);

// Find end of InstallPackageSchema
const installSchemaIdx = editor.findLine('const InstallPackageSchema = z.object');
let schemaEnd = -1;
if (installSchemaIdx !== -1) {
  for (let i = installSchemaIdx; i < editor.lines.length; i++) {
    if (editor.lines[i].trim() === '});' && i + 1 < editor.lines.length && editor.lines[i + 1].trim() === '') {
      schemaEnd = i + 2;
      break;
    }
  }
}
if (schemaEnd === -1) throw new Error('InstallPackageSchema end not found');

const schemaLines = [
  '',
  'const BatchExecuteSchema = z.object({',
  '  operations: z.array(',
  '    z.object({',
  '      name: z.string(),',
  '      arguments: z.record(z.unknown()).optional(),',
  '    })',
  '  ),',
  '});',
  ''
];
editor.insertAtLine(schemaEnd, schemaLines);

// Find end of install-package tool definition
const installToolIdx = editor.findLine('name: "install-package"');
let toolEnd = -1;
if (installToolIdx !== -1) {
  let braceCount = 0;
  let foundStart = false;
  for (let i = installToolIdx; i < editor.lines.length; i++) {
    if (editor.lines[i].includes('{')) {
      braceCount++;
      foundStart = true;
    }
    if (editor.lines[i].includes('}') && foundStart) {
      braceCount--;
      if (braceCount === 0) {
        toolEnd = i + 1;
        break;
      }
    }
  }
}
if (toolEnd === -1) throw new Error('install-package tool end not found');

const toolLines = [
  '      {',
  '        name: "batch-execute",',
  '        description: "Execute multiple operations in a single request",',
  '        inputSchema: {',
  '          type: "object",',
  '          properties: {',
  '            operations: {',
  '              type: "array",',
  '              description: "Array of operations to execute",',
  '              items: {',
  '                type: "object",',
  '                properties: {',
  '                  name: {',
  '                    type: "string",',
  '                    description: "Name of the tool to call",',
  '                  },',
  '                  arguments: {',
  '                    type: "object",',
  '                    description: "Arguments to pass to the tool",',
  '                    additionalProperties: true,',
  '                  },',
  '                },',
  '                required: ["name"],',
  '              },',
  '            },',
  '          },',
  '          required: ["operations"],',
  '        },',
  '      }'
];
editor.insertAtLine(toolEnd, toolLines);

// Write back with original line endings
fs.writeFileSync(filePath, editor.toString(), "utf8");
console.log("Batch execute feature added successfully!");
