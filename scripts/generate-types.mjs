import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const python = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
execFileSync(python, [path.join(root, 'scripts/export-openapi.py')], {cwd: root, stdio: 'inherit'})
execFileSync(process.execPath, [path.join(root, 'node_modules/openapi-typescript/bin/cli.js'), 'docs/openapi.json', '-o', 'frontend/lib/generated-api.d.ts'], {cwd: root, stdio: 'inherit'})
