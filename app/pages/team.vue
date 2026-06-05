<script setup lang="ts">
import type { Profile, ProfileConfig } from '~/types/profile'

interface EngineInfo {
  id: string; name: string; available: boolean; version: string | null; path: string | null; error?: string
}

const { data: profiles, refresh } = await useFetch<Profile[]>('/api/profiles', { lazy: true })
const { data: engines, refresh: refreshEngines } = await useFetch<EngineInfo[]>('/api/engines', { lazy: true })

const engineMap = computed(() => {
  const m = new Map<string, EngineInfo>()
  if (engines.value) for (const e of engines.value) m.set(e.id, e)
  return m
})
const engineName = (id: string) => engineMap.value.get(id)?.name || id
const engineAvailable = (id: string) => engineMap.value.get(id)?.available ?? false

const engineItems = [
  { label: 'Hermes Agent', value: 'hermes' },
  { label: 'OpenClaw', value: 'openclaw' },
  { label: 'Claude Code', value: 'claude-code' },
]

// ── 引擎切换 ──
const switching = ref<Set<string>>(new Set())
async function setEngine(slug: string, val: string) {
  if (!val || switching.value.has(slug)) return
  switching.value = new Set([...switching.value, slug])
  try {
    await $fetch('/api/profiles/' + slug + '/config', { method: 'PUT', body: { engine: val } })
    if (profiles.value) {
      const idx = profiles.value.findIndex(p => p.slug === slug)
      if (idx >= 0) profiles.value[idx].engine = val
    }
  } catch (e: any) {
    console.error('Engine switch failed', e)
  } finally {
    const next = new Set(switching.value); next.delete(slug); switching.value = next
  }
}

// ── 模型配置弹窗 ──
const configSlug = ref<string | null>(null)
const configOpen = computed({ get: () => configSlug.value !== null, set: (v) => { if (!v) configSlug.value = null } })
const configData = ref<ProfileConfig | null>(null)
const saving = ref(false)

async function openConfig(slug: string) {
  configSlug.value = slug
  configData.value = null
  try { configData.value = await $fetch('/api/profiles/' + slug + '/config') } catch {}
}

async function saveConfig() {
  if (!configSlug.value || !configData.value) return
  saving.value = true
  try {
    await $fetch('/api/profiles/' + configSlug.value + '/config', { method: 'PUT', body: {
      givenName: configData.value.givenName,
      model: configData.value.model,
      apiKey: configData.value.apiKey,
      apiUrl: configData.value.apiUrl,
    }})
    configSlug.value = null
    await refresh()
  } catch (e: any) { console.error('Config save failed', e)
  } finally { saving.value = false }
}
</script>

<template>
  <div class="page page--team">
    <header class="tm-header">
      <div class="tm-left"><h1 class="tm-title brand-gradient">Yggdrasil</h1><span class="tm-sub">Team</span></div>
      <div class="tm-right">
        <UButton icon="i-lucide-refresh-cw" variant="ghost" color="neutral" size="sm" @click="refresh(); refreshEngines()" />
      </div>
    </header>
    <div class="tm-body">
      <!-- 引擎状态 -->
      <section class="tm-section">
        <h2 class="sec-title"><UIcon name="i-lucide-cpu" class="sec-ico" />Engines</h2>
        <div class="engine-grid">
          <div v-for="e in engines" :key="e.id" class="engine-card" :class="{ available: e.available }">
            <div class="ec-glyph"><UIcon name="i-lucide-server" /></div>
            <div class="ec-info">
              <span class="ec-name">{{ e.name }}</span>
              <span class="ec-ver">{{ e.version || '-' }}</span>
              <span v-if="!e.available" class="ec-err text-xs">{{ e.error }}</span>
            </div>
            <UIcon :name="e.available ? 'i-lucide-circle-check' : 'i-lucide-circle-x'" class="ec-state" :class="e.available ? 'on' : 'off'" />
          </div>
        </div>
      </section>

      <!-- Agent列表 -->
      <section class="tm-section">
        <h2 class="sec-title"><UIcon name="i-lucide-users-round" class="sec-ico" />Agents</h2>
        <div v-if="!profiles?.length" class="empty"><UIcon name="i-lucide-user-round-search" class="empty-ico" /><span>No agents found</span></div>
        <div v-else class="profile-list">
          <div v-for="p in profiles" :key="p.slug" class="profile-card">
            <div class="pc-avatar" :style="{borderColor:'#'+p.backgroundColor}">
              <img :src="p.avatarPortraitUrl" :alt="p.slug" class="pc-img" />
            </div>
            <div class="pc-info">
              <span class="pc-name">{{ p.givenName || p.displayName }}</span>
              <span class="pc-slug">{{ p.slug }}</span>
              <div class="pc-tags">
                <span class="pc-engine" :class="engineAvailable(p.engine)?'eng-on':'eng-off'">{{ engineName(p.engine) }}</span>
                <span v-if="p.model" class="pc-model">{{ p.model }}</span>
              </div>
            </div>
            <div class="pc-actions">
              <select v-model="p.engine" class="eng-select"
              :disabled="switching.has(p.slug)"
              @change="setEngine(p.slug, p.engine)">
              <option v-for="item in engineItems" :key="item.value" :value="item.value">
                {{ item.label }}
              </option>
            </select>
            </div>
            <UButton icon="i-lucide-settings" variant="ghost" color="neutral" size="sm" @click="openConfig(p.slug)" />
          </div>
        </div>
      </section>
    </div>

    <!-- 模型配置 Slideover -->
    <USlideover v-model:open="configOpen">
      <template #title>Agent 配置</template>
      <template #body>
        <div v-if="configData" class="config-form">
          <UFormField label="显示名称">
            <UInput v-model="configData.givenName" placeholder="自定义呼号" />
          </UFormField>
          <UFormField label="模型">
            <USelectMenu v-model="configData.model" :items="[
              { label: 'Claude Sonnet 4', value: 'claude-sonnet-4-20250514' },
              { label: 'Claude 4 Opus', value: 'claude-opus-4-20250514' },
              { label: 'GPT-5', value: 'gpt-5-turbo' },
              { label: 'DeepSeek V4', value: 'deepseek-chat' },
              { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
              { label: '自定义', value: '__custom__' },
            ]" value-key="value" allow-fuzzy-search />
          </UFormField>
          <UFormField v-if="configData.model === '__custom__'" label="自定义模型 ID">
            <UInput v-model="configData.model" placeholder="provider/model-id" />
          </UFormField>
          <UFormField label="API Key">
            <UInput v-model="configData.apiKey" type="password" placeholder="sk-..." />
          </UFormField>
          <UFormField label="API URL">
            <UInput v-model="configData.apiUrl" placeholder="https://api.openai.com/v1" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="config-footer">
          <UButton color="neutral" variant="ghost" @click="configOpen = false">取消</UButton>
          <UButton color="primary" :loading="saving" @click="saveConfig">保存</UButton>
        </div>
      </template>
    </USlideover>
  </div>
</template>

<style scoped>
.tm-header{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid var(--color-border);background:var(--color-surface)}
.tm-left{display:flex;align-items:baseline;gap:12px}
.tm-title{font-size:1.2rem;font-weight:700}
.tm-sub{color:var(--color-text-muted);font-size:.85rem}
.tm-right{display:flex;gap:8px}
.tm-body{padding:24px;overflow-y:auto;flex:1;background:var(--color-bg-soft)}
.tm-section{margin-bottom:32px}
.sec-title{display:flex;align-items:center;gap:7px;font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--color-text-muted);margin-bottom:12px}
.sec-ico{font-size:.95rem;color:var(--color-primary)}
.engine-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}
.engine-card{display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:12px;box-shadow:var(--shadow-card)}
.engine-card:hover{box-shadow:var(--shadow-card-hover);border-color:var(--color-border-strong)}
.ec-glyph{width:36px;height:36px;flex-shrink:0;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;background:var(--color-surface-2);color:var(--color-text-muted)}
.engine-card.available .ec-glyph{background:var(--gradient-green-soft);color:var(--color-primary-strong)}
.ec-info{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.ec-name{font-size:.85rem;font-weight:600}
.ec-ver{font-size:.7rem;color:var(--color-text-muted)}
.ec-err{font-size:.7rem;color:var(--color-danger)}
.ec-state{font-size:1.05rem;flex-shrink:0}
.ec-state.on{color:var(--color-success)}
.ec-state.off{color:var(--color-danger)}
.profile-list{display:flex;flex-direction:column;gap:6px}
.profile-card{display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:12px;box-shadow:var(--shadow-card)}
.profile-card:hover{box-shadow:var(--shadow-card-hover);border-color:var(--color-border-strong)}
.pc-avatar{width:40px;height:40px;border-radius:50%;border:2px solid;overflow:hidden;flex-shrink:0;background:var(--color-surface-2)}
.pc-img{width:100%;height:100%;object-fit:cover}
.pc-info{flex:1;display:flex;flex-direction:column;gap:3px;min-width:0}
.pc-name{font-size:.85rem;font-weight:600}
.pc-slug{font-size:.7rem;color:var(--color-text-muted)}
.pc-tags{display:flex;gap:4px;flex-wrap:wrap}
.pc-engine{display:inline-flex;align-items:center;gap:4px;font-size:.65rem;padding:2px 8px;border-radius:999px;width:fit-content}
.pc-model{font-size:.65rem;padding:2px 8px;border-radius:999px;background:var(--color-surface-2);color:var(--color-text-muted)}
.eng-on{background:var(--color-primary-soft);color:var(--color-primary-strong)}
.eng-off{background:rgba(220,38,38,.12);color:var(--color-danger)}
.pc-actions{display:flex;align-items:center;gap:4px}
.config-form{display:flex;flex-direction:column;gap:16px}
.config-form :deep(label){font-size:.85rem;font-weight:600;margin-bottom:4px}
.config-footer{display:flex;justify-content:flex-end;gap:8px}
.empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:40px 24px;text-align:center;color:var(--color-text-muted);font-size:.85rem}
.empty-ico{font-size:1.75rem;color:var(--color-border-strong)}
</style>
