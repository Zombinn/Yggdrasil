import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { homedir } from 'node:os'

// ── Types ────────────────────────────────────────────
export interface AcpPoolEntry {
  slug: string
  child: ChildProcess
  initialized: boolean
  sessionEmitters: Map<string, EventEmitter>
  inFlight: Set<string>
  lastActivityMs: number
}

export interface PromptHandle {
  emitter: EventEmitter
  done: Promise<{ stopReason: string }>
  cancel: () => Promise<void>
}

export interface StartPromptOpts {
  slug: string
  sessionId: string
  text: string
}

// ── Pool ─────────────────────────────────────────────
const pool = new Map<string, AcpPoolEntry>()
const IDLE_TIMEOUT_MS = Number(process.env.YGGDRASIL_ACP_IDLE_MS) || 60 * 60 * 1000
const REAPER_INTERVAL_MS = 60 * 1000

/** 修复 rawIO schema 不匹配的 Transform 流（参考 Hermes War Room） */
function fixupRawIO(): TransformStream<Uint8Array, Uint8Array> {
  let buffer = ''
  return new TransformStream({
    transform(chunk, controller) {
      buffer += new TextDecoder().decode(chunk)
      let nl = buffer.indexOf('\n')
      while (nl >= 0) {
        const line = buffer.slice(0, nl)
        buffer = buffer.slice(nl + 1)
        try {
          const obj = JSON.parse(line) as { params?: { update?: Record<string, unknown> } }
          const update = obj?.params?.update
          if (update) {
            for (const key of ['rawInput', 'rawOutput'] as const) {
              const v = update[key]
              if (typeof v === 'string') {
                try {
                  const parsed = JSON.parse(v)
                  update[key] = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { value: parsed }
                } catch { update[key] = { raw: v } }
              }
            }
          }
          controller.enqueue(new TextEncoder().encode(JSON.stringify(obj) + '\n'))
        } catch {
          controller.enqueue(new TextEncoder().encode(line + '\n'))
        }
        nl = buffer.indexOf('\n')
      }
    }
  })
}

/** 为 slug 生成 ACP 子进程 */
async function spawnEntry(slug: string, cwd?: string): Promise<AcpPoolEntry> {
  const sd = new EventEmitter()
  return new Promise((resolve, reject) => {
    const toolset = process.env.YGGDRASIL_ACP_TOOLSETS || 'terminal,skills,todo,memory,clarify,messaging'
    const child = spawn('hermes', ['-p', slug, '-t', toolset, 'acp'], {
      cwd: cwd || process.env.HERMES_HOME || homedir(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    })

    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (d: string) => process.stderr.write('[acp:' + slug + '] ' + d))

    let exited = false
    child.on('error', (err: Error) => { pool.delete(slug); if (!exited) reject(err) })
    child.on('exit', (code, signal) => {
      exited = true
      console.error('[acp:' + slug + '] exited code=' + code + ' signal=' + signal)
      pool.delete(slug)
    })
    if (!child.stdin || !child.stdout) { child.kill(); reject(new Error('no stdio')); return }

    // 使用 fixupRawIO 处理 stdout
    const fixed = child.stdout.pipeThrough(fixupRawIO())

    const entry: AcpPoolEntry = {
      slug, child, initialized: false,
      sessionEmitters: new Map(), inFlight: new Set(),
      lastActivityMs: Date.now()
    }
    pool.set(slug, entry)

    // 读取初始化消息
    const reader = fixed.getReader()
    reader.read().then(() => {
      entry.initialized = true
      resolve(entry)
    }).catch((err) => {
      child.kill(); pool.delete(slug); reject(err)
    })
  })
}

async function getEntry(slug: string): Promise<AcpPoolEntry> {
  const existing = pool.get(slug)
  if (existing && !existing.child.killed && existing.initialized) {
    existing.lastActivityMs = Date.now()
    return existing
  }
  if (existing) pool.delete(slug)
  return spawnEntry(slug)
}

// ── Public API ───────────────────────────────────────

/** 关闭 slug 的 ACP 连接（配置更新后重新加载） */
export function restart(slug: string): { killed: boolean } {
  const entry = pool.get(slug)
  if (!entry) return { killed: false }
  try { entry.child.kill('SIGTERM') } catch {}
  pool.delete(slug)
  return { killed: true }
}

/** 预热 ACP 连接（页面加载时调用，避免冷启动 delay） */
export async function warmup(slug: string): Promise<{ alreadyWarm: boolean }> {
  const existing = pool.get(slug)
  if (existing?.initialized && !existing.child.killed) {
    existing.lastActivityMs = Date.now()
    return { alreadyWarm: true }
  }
  await getEntry(slug)
  return { alreadyWarm: false }
}

/** 创建新 Session */
export async function newSession(slug: string, cwd?: string): Promise<string> {
  const entry = await getEntry(slug)
  const body = JSON.stringify({ type: 'newSession', sessionId: crypto.randomUUID(), cwd: cwd || homedir() })
  entry.child.stdin?.write(body + '\n')
  return JSON.parse(body).sessionId
}

/** 发送消息并流式返回 */
export function startPrompt(opts: StartPromptOpts): PromptHandle {
  const emitter = new EventEmitter()
  const done = (async () => {
    const entry = await getEntry(opts.slug)
    if (entry.inFlight.has(opts.sessionId)) throw new Error('Session ' + opts.sessionId + ' already in flight')
    entry.inFlight.add(opts.sessionId)
    entry.sessionEmitters.set(opts.sessionId, emitter)
    entry.lastActivityMs = Date.now()
    try {
      const body = JSON.stringify({ type: 'prompt', sessionId: opts.sessionId, text: opts.text })
      entry.child.stdin?.write(body + '\n')
      // 等待完成信号（简化处理）
      const stopReason = 'end_turn'
      emitter.emit('done', { stopReason })
      return { stopReason }
    } catch (e) {
      emitter.emit('error', e)
      throw e
    } finally {
      entry.inFlight.delete(opts.sessionId)
      entry.sessionEmitters.delete(opts.sessionId)
      entry.lastActivityMs = Date.now()
    }
  })()
  done.catch(() => {})
  return { emitter, done, cancel: async () => { /* cancel logic */ } }
}

// ── Reaper ───────────────────────────────────────────
let reaperStarted = false
function ensureReaper() {
  if (reaperStarted) return
  reaperStarted = true
  const reaper = setInterval(() => {
    const now = Date.now()
    for (const [slug, entry] of pool) {
      if (entry.inFlight.size > 0) continue
      if (now - entry.lastActivityMs > IDLE_TIMEOUT_MS) {
        console.error('[acp:' + slug + '] idle timeout, shutting down')
        try { entry.child.kill('SIGTERM') } catch {}
        pool.delete(slug)
      }
    }
  }, REAPER_INTERVAL_MS)
  reaper.unref()
}
ensureReaper()

function shutdownAll() {
  for (const [slug, entry] of pool) {
    try { entry.child.kill('SIGTERM') } catch {}
    pool.delete(slug)
  }
}
process.once('SIGINT', shutdownAll)
process.once('SIGTERM', shutdownAll)
process.once('beforeExit', shutdownAll)

// ── 预热 API 路由 ────────────────────────────────────
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const slug = typeof query.slug === 'string' ? query.slug : 'default'
  return await warmup(slug)
})
