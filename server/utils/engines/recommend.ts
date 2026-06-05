import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { parse } from 'yaml'
import { listActiveTasks } from './kanban'
import type { EngineId, EngineDetection } from './types'

export interface EngineRecommendation {
  engine: EngineId
  score: number          // 0-100, 越高越推荐
  reasons: string[]      // 推荐理由
}

/**
 * 自动推荐最适合的引擎
 * 基于系统环境检测 + Profile 特性分析
 */
export async function recommendEngine(detections: EngineDetection[]): Promise<EngineRecommendation[]> {
  const scores: EngineRecommendation[] = []

  const hermes = detections.find(d => d.id === 'hermes')
  const openclaw = detections.find(d => d.id === 'openclaw')
  const claude = detections.find(d => d.id === 'claude-code')

  // Hermes 评分
  if (hermes?.available) {
    const hermesHome = join(homedir(), '.hermes')
    let score = 70
    const reasons: string[] = ['Hermes Agent 已安装']

    // 有 kanban.db → 加分（编排能力）
    if (existsSync(join(hermesHome, 'kanban.db'))) {
      score += 15
      reasons.push('Kanban 任务系统可用')
    }

    // 有 profiles → 加分（多 Agent）
    const profilesDir = join(hermesHome, 'profiles')
    if (existsSync(profilesDir)) {
      try {
        const entries = readdirSync(profilesDir).filter(e => statSync(join(profilesDir, e)).isDirectory())
        if (entries.length > 0) {
          score += Math.min(entries.length * 5, 15)
          reasons.push(`${entries.length} 个 Agent Profile`)
        }
      } catch {}
    }

    scores.push({ engine: 'hermes', score, reasons })
  }

  // OpenClaw 评分
  if (openclaw?.available) {
    const openclawHome = join(homedir(), '.openclaw')
    let score = 50
    const reasons: string[] = ['OpenClaw 已安装']

    if (existsSync(join(openclawHome, 'workspace'))) {
      score += 15
      reasons.push('工作区已配置')
    }

    scores.push({ engine: 'openclaw', score, reasons })
  }

  // Claude Code 评分
  if (claude?.available) {
    let score = 40
    const reasons: string[] = ['Claude Code CLI 可用']

    // 当前目录有 claude.md → 加分
    if (existsSync(join(process.cwd(), 'CLAUDE.md'))) {
      score += 15
      reasons.push('项目 Claude 配置已存在')
    }

    scores.push({ engine: 'claude-code', score, reasons })
  }

  // 按评分降序排序
  scores.sort((a, b) => b.score - a.score)
  return scores
}

/**
 * 为特定 Profile 推荐引擎
 */
export async function recommendForProfile(slug: string): Promise<EngineRecommendation[]> {
  const detections: EngineDetection[] = []
  for (const id of ['hermes', 'openclaw', 'claude-code'] as EngineId[]) {
    try {
      const result = execSync(`which ${id === 'claude-code' ? 'claude' : id} 2>/dev/null || echo ""`, { encoding: 'utf-8', timeout: 3000 })
      detections.push({ id, name: id === 'claude-code' ? 'Claude Code' : id === 'hermes' ? 'Hermes Agent' : 'OpenClaw',
        available: !!result.trim(), version: null, path: result.trim() || null })
    } catch {
      detections.push({ id, name: id, available: false, version: null, path: null })
    }
  }
  return recommendEngine(detections)
}
