import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const startBackend = process.env.VISIONABLE_DEMO_ONLY !== '1'
const processSpecs = [
  ...(startBackend ? [{
    name: 'backend',
    args: [path.join(root, 'server/src/server.js')],
  }] : []),
  {
    name: 'frontend',
    args: [path.join(root, 'node_modules/vite/bin/vite.js')],
  },
]

if (!startBackend) {
  console.log('VISIONABLE_DEMO_ONLY=1; starting the frontend only.')
}

const processes = processSpecs.map(({ name, args }) => {
  const child = spawn(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
  })

  child.on('error', (error) => {
    console.error(`Could not start ${name}: ${error.message}`)
    stop(1)
  })

  child.on('exit', (code) => {
    if (!stopping) {
      console.error(`${name} stopped${code === 0 ? '' : ` with exit code ${code ?? 1}`}.`)
      stop(code ?? 1)
    }
  })

  return child
})

let stopping = false

function stop(exitCode, signal = 'SIGTERM') {
  if (stopping) return
  stopping = true
  process.exitCode = exitCode
  processes.forEach((child) => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(signal)
    }
  })
}

process.on('SIGINT', () => stop(0, 'SIGINT'))
process.on('SIGTERM', () => stop(0, 'SIGTERM'))
