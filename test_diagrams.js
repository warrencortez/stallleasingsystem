const fs = require('fs');

const html = fs.readFileSync('architecture_diagrams.html', 'utf8');
const match = html.match(/const DIAGRAM_SOURCES = ({[\s\S]*?});/);
if (!match) {
  console.error("DIAGRAM_SOURCES not found!");
  process.exit(1);
}

const sources = eval('(' + match[1] + ')');
console.log("Found diagram keys:", Object.keys(sources));
for (const [key, val] of Object.entries(sources)) {
  console.log(`Key: ${key}, Length: ${val.length} chars`);
}
console.log("All diagram sources extracted successfully!");
