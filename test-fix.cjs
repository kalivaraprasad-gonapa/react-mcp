const fs = require('fs');

// Inline the fixed handleEditFile function for testing
async function handleEditFile(params) {
  try {
    const { filePath, content } = params;
    const path = require('path');

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
    // Normalize line endings for JS/JSX/TS/TSX files to prevent whitespace issues
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
    fs.writeFileSync(filePath, normalizedContent, "utf8");

    return {
      message: `File ${filePath} updated successfully`,
      filePath: filePath,
      size: Buffer.byteLength(normalizedContent, "utf8"),
    };
  } catch (error) {
    return {
      error: `Error editing file: ${error.message}`,
    };
  }
}

// Test with JSX content that has CRLF line endings
const testContent = 'import React from "react";\r\nconst App = () => {\r\n  return <div>Hello</div>;\r\n};\r\nexport default App;';

const params = { filePath: 'C:\mcp\react-mcp\test.jsx', content: testContent };

handleEditFile(params).then(result => {
  console.log('Result:', result);
  
  if (fs.existsSync('C:\mcp\react-mcp\test.jsx')) {
    const content = fs.readFileSync('C:\mcp\react-mcp\test.jsx', 'utf8');
    console.log('\nWritten content:');
    console.log(JSON.stringify(content));
    console.log('\nHas CRLF (\\r\\n):', content.includes('\r\n'));
    console.log('Has CR (\\r):', content.includes('\r'));
    console.log('Ends with newline:', content.endsWith('\n'));
    
    // Clean up
    fs.unlinkSync('C:\mcp\react-mcp\test.jsx');
    console.log('\nTest file cleaned up');
    
    // Verify the fix works
    if (!content.includes('\r') && content.endsWith('\n')) {
      console.log('\n✓ SUCCESS: Line endings normalized correctly!');
    } else {
      console.log('\n✗ FAILED: Line endings not normalized');
    }
  }
}).catch(err => console.error('Error:', err));
