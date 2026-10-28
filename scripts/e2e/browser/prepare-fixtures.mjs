import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { login } from '../lifecycle/lib.mjs';
const admin = await login('mys@pmcm.test', process.env.PRISM_SEED_PASSWORD_ADMIN);
if (!admin.token) throw new Error('Browser fixture administrator could not sign in.');
writeFileSync(join(process.env.BROWSER_RUN_DIRECTORY, 'actors.json'), JSON.stringify({ adminToken: admin.token }), { mode: 0o600 });
