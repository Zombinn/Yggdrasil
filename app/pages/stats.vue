<script setup lang="ts">
interface StatsByEngine {
  engine: string; total: number; completed: number; failed: number
  avgDuration: number | null; totalTokensIn: number; totalTokensOut: number
}
interface StatsByProfile {
  profileSlug: string; engine: string; total: number; completed: number; avgDuration: number | null
}
interface RecentTask {
  id: number; engine: string; profileSlug: string; status: string
  durationMs: number; error: string | null; created_at: string
}
interface RecoInfo {
  engine: string; score: number; reasons: string[]
}

const { data: stats } = useFetch<{ byEngine: StatsByEngine[]; byProfile: StatsByProfile[]; recent: RecentTask[] }>('/api/stats', { lazy: true })
const { data: reco } = useFetch<{ recommendations: RecoInfo[] }>('/api/engines/recommend', { lazy: true })
const recommendations = computed(() => reco.value?.recommendations ?? [])

const engineNames: Record<string, string> = { hermes: 'Hermes Agent', openclaw: 'OpenClaw', 'claude-code': 'Claude Code' }
const en = (id: string) => engineNames[id] || id
</script>

<template>
  <div class="page page--stats">
    <header class="st-header">
      <div class="st-left"><h1 class="st-title brand-gradient">Yggdrasil</h1><span class="st-sub">Stats</span></div>
    </header>
    <div class="st-body">
      <!-- 推荐引擎 -->
      <section class="st-section">
        <h2 class="sec-title"><UIcon name="i-lucide-wand-sparkles" class="sec-ico" />Recommendations</h2>
        <div v-if="recommendations.length" class="reco-list">
          <div v-for="r in recommendations" :key="r.engine" class="reco-card" :class="'reco-' + (r.score >= 70 ? 'high' : r.score >= 40 ? 'mid' : 'low')">
            <div class="reco-score brand-gradient">{{ r.score }}<span class="reco-unit">/100</span></div>
            <div class="reco-info">
              <span class="reco-name"><UIcon name="i-lucide-cpu" class="reco-name-ico" />{{ en(r.engine) }}</span>
              <ul class="reco-reasons"><li v-for="reason in r.reasons" :key="reason"><UIcon name="i-lucide-check" class="reco-reason-ico" />{{ reason }}</li></ul>
            </div>
          </div>
        </div>
        <div v-else class="empty"><UIcon name="i-lucide-loader" class="empty-ico spin" /><span>检测中…</span></div>
      </section>

      <!-- 引擎统计 -->
      <section class="st-section">
        <h2 class="sec-title"><UIcon name="i-lucide-cpu" class="sec-ico" />Engine Stats</h2>
        <div v-if="stats?.byEngine?.length" class="stat-table">
          <div class="stat-row stat-head">
            <span class="stat-cell">Engine</span>
            <span class="stat-cell">总任务</span>
            <span class="stat-cell">成功</span>
            <span class="stat-cell">失败</span>
            <span class="stat-cell">平均耗时</span>
            <span class="stat-cell">Token消耗</span>
          </div>
          <div v-for="e in stats.byEngine" :key="e.engine" class="stat-row">
            <span class="stat-cell">{{ en(e.engine) }}</span>
            <span class="stat-cell">{{ e.total }}</span>
            <span class="stat-cell stat-ok">{{ e.completed }}</span>
            <span class="stat-cell stat-err">{{ e.failed }}</span>
            <span class="stat-cell">{{ e.avgDuration ? Math.round(e.avgDuration) + 'ms' : '-' }}</span>
            <span class="stat-cell">{{ (e.totalTokensIn + e.totalTokensOut) || '-' }}</span>
          </div>
        </div>
        <div v-else class="empty"><UIcon name="i-lucide-database" class="empty-ico" /><span>No data yet (appears after tasks run)</span></div>
      </section>

      <!-- Profile 统计 -->
      <section class="st-section">
        <h2 class="sec-title"><UIcon name="i-lucide-users-round" class="sec-ico" />Agent Stats</h2>
        <div v-if="stats?.byProfile?.length" class="stat-table">
          <div class="stat-row stat-head">
            <span class="stat-cell">Agent</span>
            <span class="stat-cell">Engine</span>
            <span class="stat-cell">任务数</span>
            <span class="stat-cell">完成</span>
            <span class="stat-cell">平均耗时</span>
          </div>
          <div v-for="p in stats.byProfile" :key="p.profileSlug" class="stat-row">
            <span class="stat-cell">{{ p.profileSlug }}</span>
            <span class="stat-cell">{{ en(p.engine) }}</span>
            <span class="stat-cell">{{ p.total }}</span>
            <span class="stat-cell stat-ok">{{ p.completed }}</span>
            <span class="stat-cell">{{ p.avgDuration ? Math.round(p.avgDuration) + 'ms' : '-' }}</span>
          </div>
        </div>
        <div v-else class="empty"><UIcon name="i-lucide-database" class="empty-ico" /><span>No data</span></div>
      </section>

      <!-- 最近任务 -->
      <section class="st-section">
        <h2 class="sec-title"><UIcon name="i-lucide-history" class="sec-ico" />Recent Tasks</h2>
        <div v-if="stats?.recent?.length" class="recent-list">
          <div v-for="t in stats.recent" :key="t.id" class="recent-item">
            <span class="ri-status" :class="t.status === 'completed' ? 'ri-ok' : 'ri-err'">
              <UIcon :name="t.status === 'completed' ? 'i-lucide-circle-check' : 'i-lucide-circle-x'" class="ri-status-ico" />{{ t.status }}
            </span>
            <span class="ri-engine">{{ en(t.engine) }}</span>
            <span class="ri-profile">{{ t.profileSlug }}</span>
            <span class="ri-dur"><UIcon name="i-lucide-clock" class="ri-dur-ico" />{{ t.durationMs }}ms</span>
            <span v-if="t.error" class="ri-err">{{ t.error.slice(0, 50) }}</span>
          </div>
        </div>
        <div v-else class="empty"><UIcon name="i-lucide-file-clock" class="empty-ico" /><span>No task records</span></div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.st-header{display:flex;align-items:center;padding:16px 24px;border-bottom:1px solid var(--color-border);background:var(--color-surface)}
.st-left{display:flex;align-items:baseline;gap:12px}
.st-title{font-size:1.2rem;font-weight:700}
.st-sub{color:var(--color-text-muted);font-size:.85rem}
.st-body{padding:24px;overflow-y:auto;flex:1;background:var(--color-bg-soft)}
.st-section{margin-bottom:32px}
.sec-title{display:flex;align-items:center;gap:7px;font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--color-text-muted);margin-bottom:12px}
.sec-ico{font-size:.95rem;color:var(--color-primary)}

/* Recommendations */
.reco-list{display:flex;gap:12px;flex-wrap:wrap}
.reco-card{display:flex;align-items:flex-start;gap:16px;padding:16px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:12px;min-width:250px;flex:1;box-shadow:var(--shadow-card);transition:box-shadow .15s,border-color .15s}
.reco-card:hover{box-shadow:var(--shadow-card-hover)}
.reco-high{border-left:3px solid var(--color-success)}
.reco-mid{border-left:3px solid var(--color-warning)}
.reco-low{border-left:3px solid var(--color-danger)}
.reco-score{font-size:2rem;font-weight:700;line-height:1}
.reco-unit{font-size:.8rem;color:var(--color-text-muted);-webkit-text-fill-color:var(--color-text-muted)}
.reco-info{display:flex;flex-direction:column;gap:6px}
.reco-name{display:flex;align-items:center;gap:6px;font-size:.9rem;font-weight:600}
.reco-name-ico{font-size:1rem;color:var(--color-primary)}
.reco-reasons{margin:0;padding:0;list-style:none}
.reco-reasons li{display:flex;align-items:center;gap:6px;font-size:.75rem;color:var(--color-text-muted);padding:2px 0}
.reco-reason-ico{font-size:.85rem;color:var(--color-success);flex-shrink:0}

/* Tables */
.stat-table{display:flex;flex-direction:column;gap:3px}
.stat-row{display:grid;grid-template-columns:1fr 80px 60px 60px 100px 100px;gap:8px;padding:8px 12px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:6px;font-size:.8rem}
.stat-head{font-weight:600;color:var(--color-text-muted);font-size:.7rem;text-transform:uppercase;background:var(--color-surface-2)}
.stat-ok{color:var(--color-success)}
.stat-err{color:var(--color-danger)}

/* Recent */
.recent-list{display:flex;flex-direction:column;gap:3px}
.recent-item{display:flex;align-items:center;gap:12px;padding:6px 12px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:6px;font-size:.75rem}
.ri-status{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;font-size:.65rem;font-weight:600}
.ri-status-ico{font-size:.8rem}
.ri-ok{background:var(--color-primary-soft);color:var(--color-primary-strong)}
.ri-err{background:rgba(220,38,38,.12);color:var(--color-danger)}
.ri-engine{color:var(--color-text-muted)}
.ri-profile{font-weight:600}
.ri-dur{display:inline-flex;align-items:center;gap:4px;color:var(--color-text-muted);margin-left:auto}
.ri-dur-ico{font-size:.8rem}

.empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:40px 24px;text-align:center;color:var(--color-text-muted);font-size:.85rem}
.empty-ico{font-size:1.75rem;color:var(--color-border-strong)}
.spin{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
