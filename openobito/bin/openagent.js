#!/usr/bin/env node

if (process.platform === 'win32') {
  process.argv[0] = 'node';
}

const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.error('OpenAgent requires Node.js 18+. Current: v' + process.versions.node);
  process.exit(1);
}

import('../dist/index.js').catch(err => {
  console.error('\nError:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
