/**
 * Carga .env de la raíz y arranca turbo dev (todos los workspaces heredan las vars).
 */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadRootEnv } from './lib/load-env.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

loadRootEnv()

const child = spawn('npx', ['turbo', 'run', 'dev'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true,
  env: process.env,
})

child.on('exit', (code) => process.exit(code ?? 0))

process.on('SIGINT', () => child.kill('SIGINT'))
process.on('SIGTERM', () => child.kill('SIGTERM'))
