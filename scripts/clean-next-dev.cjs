const fs = require("node:fs");
const path = require("node:path");

const target = path.join(process.cwd(), ".next", "dev");
fs.rmSync(target, { recursive: true, force: true });
