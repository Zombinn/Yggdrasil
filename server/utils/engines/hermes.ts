import { execSync } from 'node:child_process'
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { parse } from 'yaml'
import type { EngineAdapter, EngineDetection, EngineProfile, KanbanTask } from './types'
import { listActiveTasks, dispatcherLikelyStale } from './kanban'

const HOME = homedir()
const HERMES_HOME = process.env.HERMES_HOME || join(HOME, '.hermes')
const OPENCLAW_HOME = join(HOME, '.openclaw')

// ── Hermes Adapter ──────────────────────────────────
export const hermesAdapter: EngineAdapter = {
  id: 'hermes',
  name: 'Hermes Agent',

  async detect(): Promise<EngineDetection> {
    try {
      const result = execSync('which hermes 2>/dev/null', { encoding: 'utf-8', timeout: 5000 })
      const path = result.trim()
      if (!path) throw new Error('not found')
      let version: string | null = null
      try { version = execSync(path + ' --version 2>/dev/null', { encoding: 'utf-8', timeout: 5000 }).trim() || null } catch {}
      return { id: 'hermes', name: 'Hermes Agent', available: true, version, path }
    } catch {
      try {
        execSync('python3 -c "import hermes_agent; print(1)" 2>/dev/null', { encoding: 'utf-8', timeout: 5000 })
        return { id: 'hermes', name: 'Hermes Agent (Python)', available: true, version: 'pip', path: 'python3 -m hermes_agent' }
      } catch {
        return { id: 'hermes', name: 'Hermes Agent', available: false, version: null, path: null, error: 'Not installed. try: pip install hermes-agent' }
      }
    }
  },

  async discoverProfiles(): Promise<EngineProfile[]> {
    const out: EngineProfile[] = []
    try { statSync(HERMES_HOME) } catch { return out }
    out.push({ slug: 'default', displayName: null, engine: 'hermes', isDefault: true, hermesDir: HERMES_HOME })
    const profilesDir = join(HERMES_HOME, 'profiles')
    let entries: string[] = []
    try { entries = readdirSync(profilesDir) } catch { return out }
    for (const name of entries) {
      const dir = join(profilesDir, name)
      try {
        if (statSync(dir).isDirectory()) {
          let displayName: string | null = null
          const configPath = join(dir, 'config.yaml')
          if (existsSync(configPath)) {
            try { const config = parse(readFileSync(configPath, 'utf-8')); displayName = config?.name ?? null } catch {}
          }
          out.push({ slug: name, displayName, engine: 'hermes', isDefault: false, hermesDir: dir })
        }
      } catch {}
    }
    return out
  },

  readKanban(assignee?: string) { return listActiveTasks(assignee) },
  isDispatcherStale() { return dispatcherLikelyStale() }
}

// ── OpenClaw Adapter ────────────────────────────────
export const openclawAdapter: EngineAdapter = {
  id: 'openclaw',
  name: 'OpenClaw',

  async detect(): Promise<EngineDetection> {
    // Check global npm, npx, or local
    for (const cmd of ['openclaw', 'npx openclaw']) {
      try {
        const result = execSync(cmd + ' --version 2>/dev/null', { encoding: 'utf-8', timeout: 5000 })
        const v = result.trim()
        return { id: 'openclaw', name: 'OpenClaw', available: true, version: v || 'installed', path: cmd.split(' ')[0] }
      } catch {}
    }
    // Check npm global
    try {
      execSync('npm ls -g openclaw 2>/dev/null', { encoding: 'utf-8', timeout: 5000 })
      return { id: 'openclaw', name: 'OpenClaw', available: true, version: 'npm global', path: 'openclaw' }
    } catch {}
    return { id: 'openclaw', name: 'OpenClaw', available: false, version: null, path: null, error: 'Not installed. try: npm install -g openclaw' }
  },

  async discoverProfiles(): Promise<EngineProfile[]> {
    try { statSync(OPENCLAW_HOME) } catch { return [] }
    return [{ slug: 'default', displayName: null, engine: 'openclaw', isDefault: true, hermesDir: OPENCLAW_HOME }]
  }
}

// ── Claude Code Adapter ─────────────────────────────
export const claudeCodeAdapter: EngineAdapter = {
  id: 'claude-code',
  name: 'Claude Code',

  async detect(): Promise<EngineDetection> {
    for (const cmd of ['claude', 'codex']) {
      try {
        const result = execSync('which ' + cmd + ' 2>/dev/null', { encoding: 'utf-8', timeout: 5000 })
        const path = result.trim()
        if (path) {
          return { id: 'claude-code', name: 'Claude Code', available: true, version: 'CLI', path }
        }
      } catch {}
    }
    return { id: 'claude-code', name: 'Claude Code', available: false, version: null, path: null, error: 'Not found. Install from https://docs.anthropic.com/en/docs/claude-code' }
  },

  async discoverProfiles(): Promise<EngineProfile[]> {
    return [{ slug: 'default', displayName: 'Claude Code (current project)', engine: 'claude-code', isDefault: true, hermesDir: process.cwd() }]
  }
}
