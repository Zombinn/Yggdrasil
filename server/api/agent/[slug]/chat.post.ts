import { spawn } from 'node:child_process'
import { homedir } from 'node:os'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'slug required' })
  const body = await readBody<{ message: string; sessionId?: string }>(event)
  if (!body?.message) throw createError({ statusCode: 400, statusMessage: 'message required' })

  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'Connection', 'keep-alive')

  const toolset = process.env.YGGDRASIL_ACP_TOOLSETS || 'terminal,skills,todo,memory,clarify,messaging'
  const cwd = process.env.HERMES_HOME || homedir()
  const child = spawn('hermes', ['-p', slug, '-t', toolset, 'acp'], { cwd, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env } })
  const sessionId = body.sessionId || crypto.randomUUID()

  if (child.stdin) {
    child.stdin.write(JSON.stringify({ type: 'prompt', sessionId, text: body.message }) + '\n')
    child.stdin.end()
  }

  let buf = ''
  child.stdout?.on('data', (chunk: Buffer) => {
    buf += chunk.toString('utf-8')
    const lines = buf.split('\n'); buf = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const p = JSON.parse(line)
        event.node.res.write('data: ' + JSON.stringify({ type: p.type || 'chunk', delta: p.text || p.delta || '', sessionId }) + '\n\n')
      } catch {
        event.node.res.write('data: ' + JSON.stringify({ type: 'chunk', delta: line, sessionId }) + '\n\n')
      }
    }
  })
  child.stderr?.on('data', (d: Buffer) => {
    event.node.res.write('data: ' + JSON.stringify({ type: 'error', message: d.toString('utf-8').slice(0, 200), sessionId }) + '\n\n')
  })
  child.on('exit', () => {
    event.node.res.write('data: ' + JSON.stringify({ type: 'done', sessionId }) + '\n\n')
    event.node.res.end()
  })
  event.node.req.on('close', () => { try { child.kill() } catch {} })
})
