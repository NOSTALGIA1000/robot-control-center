import { readFileSync, writeFileSync } from 'fs';

let c = readFileSync('js/turtle.js', 'utf8');

// Find bytes: 'px/s' followed by literal backslash (0x5C) and 'n' (0x6E)
const find1 = 'px/s\\nvar';
const repl1 = 'px/s\nvar';
console.log('find1 found:', c.includes(find1));

const find2 = 'rotation\\n\\nfunction';
const repl2 = 'rotation\n\nfunction';
console.log('find2 found:', c.includes(find2));

if (c.includes(find1)) {
  c = c.replace(find1, repl1);
}
if (c.includes(find2)) {
  c = c.replace(find2, repl2);
}

writeFileSync('js/turtle.js', c);
console.log('Done');
