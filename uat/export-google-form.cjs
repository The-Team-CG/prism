// Produce one paste-ready Apps Script file without external dependencies.
const fs = require('node:fs');
const path = require('node:path');
const files = ['uat-test-cases.gs', 'build-uat-form.gs'];
const contents = files.map((name) => fs.readFileSync(path.join(__dirname, name), 'utf8'));
fs.writeFileSync(path.join(__dirname, 'PRISM-UAT-Google-Form.gs'),
  '// Paste this entire file into Code.gs at https://script.google.com/home/start\n' +
  '// Run buildUatForm. See uat/README.md.\n\n' + contents.join('\n\n'));
console.log('Created uat/PRISM-UAT-Google-Form.gs');
