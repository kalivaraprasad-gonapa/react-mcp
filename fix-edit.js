const fs = require('fs');
const path = 'C:/mcp/react-mcp/index.js';

let content = fs.readFileSync(path, 'utf8');

// Find and replace the writeFileSync line in handleEditFile
const oldCode = '    // Write content to file\n    fs.writeFileSync(filePath, content, "utf8");';
const newCode = `    // Normalize line endings for JS/JSX/TS/TSX files to prevent whitespace issues
    let normalizedContent = content;
    const fileExt = path.extname(filePath).toLowerCase();
    
    if (['.jsx', '.js', '.tsx', '.ts'].includes(fileExt)) {
      // Normalize to LF (React/JS ecosystem standard)
      normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      // Ensure file ends with a single newline
      if (!normalizedContent.endsWith('\n')) {
        normalizedContent += '\n';
      }
    }

    // Write content to file
    fs.writeFileSync(filePath, normalizedContent, "utf8");`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync(path, content, 'utf8');
  console.log('File updated successfully');
} else {
  console.log('Pattern not found, trying without comment...');
  const oldCode2 = '    fs.writeFileSync(filePath, content, "utf8");';
  if (content.includes(oldCode2)) {
    content = content.replace(oldCode2, newCode);
    fs.writeFileSync(path, content, 'utf8');
    console.log('File updated successfully (without comment)');
  } else {
    console.log('Still not found');
  }
}
