import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

export interface DiscoveredProfile {
  slug: string; isDefault: boolean; hermesDir: string; engine: string; displayName: string | null
}
export function discoverProfiles(): DiscoveredProfile[] {
  const out: DiscoveredProfile[] = []
  const hermesHome = process.env.HERMES_HOME || join(homedir(), '.hermes')
  try { statSync(hermesHome) } catch { return out }
  out.push({ slug: 'default', isDefault: true, hermesDir: hermesHome, engine: 'hermes', displayName: null })
  const profilesDir = join(hermesHome, 'profiles')
  let entries: string[] = []
  try { entries = readdirSync(profilesDir) } catch { return out }
  for (const name of entries) {
    const dir = join(profilesDir, name)
    try { if (statSync(dir).isDirectory()) out.push({ slug: name, isDefault: false, hermesDir: dir, engine: 'hermes', displayName: null }) } catch {}
  }
  return out
}
