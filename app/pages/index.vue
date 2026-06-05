<script setup lang="ts">
import type { Profile } from '~/types/profile'
import type { CurrentTask } from '~/types/mission'

const { data: profiles } = await useFetch<Profile[]>('/api/profiles', { lazy: true })
const activeProfiles = computed(() => (profiles.value ?? []).filter(p => p.active))

const { data: kd, refresh } = await useFetch<{ tasks: CurrentTask[], dispatcherStale: boolean }>('/api/kanban/tasks')
const tasks = computed(() => kd.value?.tasks ?? [])
const dispatcherStale = computed(() => kd.value?.dispatcherStale ?? false)
onMounted(() => setInterval(() => refresh(), 5000))

const taskByAssignee = computed(() => {
  const m = new Map<string, CurrentTask>()
  for (const t of tasks.value) { if (t.assignee && !m.has(t.assignee)) m.set(t.assignee, t) }
  return m
})

const sortedProfiles = computed(() => {
  return [...activeProfiles.value].sort((a, b) => {
    const ar = taskByAssignee.value.get(a.slug)?.status === 'running' ? 0 : 1
    const br = taskByAssignee.value.get(b.slug)?.status === 'running' ? 0 : 1
    return ar - br
  })
})

// ── 创建任务 ──
const showCreate = ref(false)
const newTask = ref({ title: '', assignee: '', body: '' })
const assigneeItems = computed(() => [
  { label: 'Auto（自动分配）', value: '' },
  ...activeProfiles.value.map(p => ({ label: p.givenName || p.displayName, value: p.slug })),
])
const reassignItems = computed(() => [
  { label: '取消指派', value: '' },
  ...activeProfiles.value.map(p => ({ label: p.givenName || p.displayName, value: p.slug })),
])
const creating = ref(false)
const toast = useToast()
async function createTask() {
  if (!newTask.value.title.trim()) return
  creating.value = true
  try {
    await $fetch('/api/kanban/tasks', {
      method: 'POST',
      body: { title: newTask.value.title, assignee: newTask.value.assignee || undefined, body: newTask.value.body || undefined }
    })
    toast.add({ title: 'Task created', color: 'primary', icon: 'i-lucide-check' })
    showCreate.value = false
    newTask.value = { title: '', assignee: '', body: '' }
    await refresh()
  } catch (e: any) {
    toast.add({ title: 'Failed', description: e.message, color: 'error' })
  } finally { creating.value = false }
}

// ── 任务操作 ──
const actionTask = ref<CurrentTask | null>(null)
const showTask = computed({ get: () => actionTask.value !== null, set: (v) => { if (!v) actionTask.value = null } })
const showAssign = ref(false)
const showDecompose = ref(false)
const assignSlug = ref('')
const subTasksText = ref('')
async function killTask(id: string) {
  try {
    await $fetch('/api/kanban/tasks/' + id + '/kill', { method: 'POST' })
    toast.add({ title: 'Task killed', color: 'primary' })
    actionTask.value = null; await refresh()
  } catch (e: any) { toast.add({ title: 'Failed', description: e.message, color: 'error' }) }
}
async function assignTask(id: string) {
  if (!assignSlug.value) return
  try {
    await $fetch('/api/kanban/tasks/' + id + '/assign', { method: 'POST', body: { assignee: assignSlug.value } })
    toast.add({ title: 'Assigned', color: 'primary' })
    showAssign.value = false; actionTask.value = null; await refresh()
  } catch (e: any) { toast.add({ title: 'Failed', description: e.message, color: 'error' }) }
}
async function decomposeTask(id: string) {
  if (!subTasksText.value.trim()) return
  const subs = subTasksText.value.split('\n').map(s => s.trim()).filter(Boolean)
  try {
    await $fetch('/api/kanban/tasks/' + id + '/decompose', { method: 'POST', body: { subTasks: subs } })
    toast.add({ title: 'Decomposed into ' + subs.length + ' tasks', color: 'primary' })
    showDecompose.value = false; actionTask.value = null; await refresh()
  } catch (e: any) { toast.add({ title: 'Failed', description: e.message, color: 'error' }) }
}

// ── Agent Chat ──
const chatSlug = ref<string | null>(null)
const chatOpen = computed({ get: () => chatSlug.value !== null, set: (v) => { if (!v) chatSlug.value = null } })
const chatMessages = ref<{ role: string; content: string }[]>([])
const chatInput = ref('')
const chatting = ref(false)
let chatReader: ReadableStreamDefaultReader | null = null

async function startChat(slug: string) {
  chatSlug.value = slug
  chatMessages.value = []
  chatInput.value = ''
}

async function sendChat() {
  if (!chatInput.value.trim() || !chatSlug.value) return
  const msg = chatInput.value
  chatMessages.value.push({ role: 'user', content: msg })
  chatInput.value = ''
  chatting.value = true

  try {
    const res = await fetch('/api/agent/' + chatSlug.value + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    })
    const reader = res.body?.getReader()
    if (!reader) return
    chatReader = reader
    let buf = ''
    let response = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += new TextDecoder().decode(value)
      const lines = buf.split('\n\n')
      buf = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = JSON.parse(line.slice(6))
        if (data.type === 'chunk' || data.type === undefined) {
          response += data.delta || ''
          if (chatMessages.value[chatMessages.value.length - 1]?.role === 'assistant') {
            chatMessages.value[chatMessages.value.length - 1].content = response
          } else {
            chatMessages.value.push({ role: 'assistant', content: response })
          }
        } else if (data.type === 'done') {
          chatMessages.value.push({ role: 'assistant', content: response || '(done)' })
        }
      }
    }
  } catch (e: any) {
    chatMessages.value.push({ role: 'assistant', content: 'Error: ' + e.message })
  } finally {
    chatting.value = false
    chatReader = null
  }
}
</script>

<template>
  <div class="page page--war-room">
    <header class="wr-header">
      <div class="wr-left"><h1 class="wr-title brand-gradient">Yggdrasil</h1><span class="wr-sub">War Room</span></div>
      <div class="wr-right">
        <UButton v-if="dispatcherStale" color="warning" size="sm" variant="soft" icon="i-lucide-triangle-alert">Dispatcher 无响应</UButton>
        <UButton icon="i-lucide-plus" color="primary" size="sm" @click="showCreate = true">New Task</UButton>
        <UButton icon="i-lucide-refresh-cw" variant="ghost" color="neutral" size="sm" @click="refresh()" />
      </div>
    </header>
    <div class="wr-body">
      <section class="col-board">
        <h2 class="sec-title"><UIcon name="i-lucide-layout-dashboard" class="sec-ico" />Board</h2>
        <div v-if="tasks.length===0" class="empty"><UIcon name="i-lucide-inbox" class="empty-ico" /><span>No active tasks</span><UButton size="sm" color="primary" variant="soft" @click="showCreate=true">Create one</UButton></div>
        <div v-else class="board">
          <div v-for="col in [{s:'triage',l:'Triage'},{s:'todo',l:'Todo'},{s:'ready',l:'Ready'},{s:'running',l:'Running'},{s:'blocked',l:'Blocked'}]" :key="col.s" class="b-col">
            <header class="b-head"><span class="b-label">{{ col.l }}</span><span class="b-cnt">{{ tasks.filter(t=>t.status===col.s).length }}</span></header>
            <div class="b-cards">
              <div v-for="t in tasks.filter(t=>t.status===col.s)" :key="t.id" class="b-card" @click="actionTask = t">
                <div class="b-stripe" :style="{background:'#'+(activeProfiles.find(p=>p.slug===t.assignee)?.backgroundColor||'6366f1')}"></div>
                <div class="b-body"><span class="b-call">{{ (t.assignee||'?').toUpperCase() }}</span><p class="b-title">{{ t.title||'\u2014' }}</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section class="col-floor">
        <h2 class="sec-title"><UIcon name="i-lucide-users-round" class="sec-ico" />Operatives</h2>
        <div v-if="sortedProfiles.length===0" class="empty"><UIcon name="i-lucide-user-round-search" class="empty-ico" /><span>No Agent profiles found</span></div>
        <div v-else class="floor">
          <div v-for="p in sortedProfiles" :key="p.slug" class="ws" :class="{active:taskByAssignee.get(p.slug)?.status==='running'}" @click="startChat(p.slug)">
            <div class="ws-avatar" :style="{borderColor:'#'+p.backgroundColor}"><img :src="p.avatarPortraitUrl" :alt="p.slug" class="ws-img" /></div>
            <span class="ws-name">{{ (p.givenName||p.displayName).toUpperCase() }}</span>
            <span class="ws-status" :class="taskByAssignee.get(p.slug)?.status||'idle'">{{ taskByAssignee.get(p.slug)?.title||'Standing by' }}</span>
            <span class="ws-chat-hint">Click to chat</span>
          </div>
        </div>
      </section>
    </div>

    <!-- Create Task Modal -->
    <UModal v-model:open="showCreate">
      <template #title>New Task</template>
      <template #body>
        <div class="create-form">
          <UFormField label="Title" required>
            <UInput v-model="newTask.title" placeholder="What needs to be done?" size="lg" class="w-full" autofocus />
          </UFormField>
          <UFormField label="Assignee" hint="Optional">
            <USelect v-model="newTask.assignee" :items="assigneeItems" size="lg" icon="i-lucide-user-round" class="w-full" />
          </UFormField>
          <UFormField label="Description" hint="Optional">
            <UTextarea v-model="newTask.body" placeholder="Add any details…" :rows="3" size="lg" class="w-full" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="modal-footer"><UButton color="neutral" variant="ghost" @click="showCreate=false">Cancel</UButton><UButton color="primary" :loading="creating" @click="createTask">Create</UButton></div>
      </template>
    </UModal>

    <!-- Task Actions Modal -->
    <UModal v-model:open="showTask">
      <template #title>{{ actionTask?.title || 'Task' }}</template>
      <template #body>
        <div v-if="actionTask" class="task-detail">
          <div class="td-row"><span class="td-label">Status</span><span class="td-val">{{ actionTask.status }}</span></div>
          <div class="td-row"><span class="td-label">Assignee</span><span class="td-val">{{ actionTask.assignee || 'unassigned' }}</span></div>
          <div class="td-row"><span class="td-label">Priority</span><span class="td-val">{{ actionTask.priority }}</span></div>
          <div class="td-row" v-if="actionTask.body"><span class="td-label">Body</span><p class="td-val">{{ actionTask.body }}</p></div>
          <USeparator class="my-3" />
          <div class="td-actions">
            <UButton v-if="actionTask.status==='running'||actionTask.status==='ready'||actionTask.status==='todo'||actionTask.status==='blocked'" color="error" size="sm" variant="soft" @click="killTask(actionTask.id)">Kill</UButton>
            <UButton color="warning" size="sm" variant="soft" @click="showAssign=true; assignSlug=actionTask.assignee||''">Reassign</UButton>
            <UButton color="primary" size="sm" variant="soft" @click="showDecompose=true; subTasksText=''">Decompose</UButton>
          </div>
          <!-- Assign sub-modal -->
          <div v-if="showAssign" class="td-sub-modal">
            <USelect v-model="assignSlug" :items="reassignItems" size="md" icon="i-lucide-user-round" class="w-full" />
            <UButton size="sm" color="primary" block @click="assignTask(actionTask!.id)">Confirm</UButton>
          </div>
          <!-- Decompose sub-modal -->
          <div v-if="showDecompose" class="td-sub-modal">
            <UTextarea v-model="subTasksText" placeholder="One sub-task per line&#10;调研&#10;编码&#10;测试" :rows="4" class="w-full" />
            <UButton size="sm" color="primary" block @click="decomposeTask(actionTask!.id)">Decompose</UButton>
          </div>
        </div>
      </template>
      <template #footer>
        <UButton color="neutral" variant="ghost" @click="actionTask=null; showAssign=false; showDecompose=false">Close</UButton>
      </template>
    </UModal>

    <!-- Agent Chat Slideover -->
    <USlideover v-model:open="chatOpen">
      <template #title>{{ chatSlug ? 'Chat with ' + chatSlug.toUpperCase() : 'Agent Chat' }}</template>
      <template #body>
        <div class="chat-box" ref="chatBox">
          <div v-for="(m, i) in chatMessages" :key="i" class="chat-msg" :class="m.role">
            <div class="chat-bubble">{{ m.content }}</div>
          </div>
          <div v-if="chatting" class="chat-msg assistant"><div class="chat-bubble chat-thinking">Thinking...</div></div>
        </div>
      </template>
      <template #footer>
        <div class="chat-input-row">
          <UInput v-model="chatInput" placeholder="Type a message..." class="chat-input" :disabled="chatting" @keydown.enter="sendChat" />
          <UButton icon="i-lucide-send" color="primary" :loading="chatting" @click="sendChat" />
        </div>
      </template>
    </USlideover>
  </div>
</template>

<style scoped>
.wr-header{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid var(--color-border);background:var(--color-surface)}
.wr-left{display:flex;align-items:baseline;gap:12px}
.wr-title{font-size:1.2rem;font-weight:700}
.wr-sub{color:var(--color-text-muted);font-size:.85rem}
.wr-right{display:flex;align-items:center;gap:8px}
.wr-body{display:grid;grid-template-columns:1fr 400px;flex:1;min-height:0;overflow:hidden;background:var(--color-bg-soft)}
.sec-title{display:flex;align-items:center;gap:7px;font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--color-text-muted);padding:16px 16px 8px}
.sec-ico{font-size:.95rem;color:var(--color-primary)}
.col-board{border-right:1px solid var(--color-border);overflow-y:auto}
.col-floor{overflow-y:auto}
.board{display:flex;gap:6px;padding:0 12px 16px}
.b-col{flex:1;min-width:0}
.b-head{display:flex;align-items:center;justify-content:space-between;padding:4px 6px;margin-bottom:4px}
.b-label{font-size:.65rem;font-weight:600;text-transform:uppercase;color:var(--color-text-muted)}
.b-cnt{font-size:.65rem;color:var(--color-text-muted);background:var(--color-surface-2);border:1px solid var(--color-border);padding:1px 6px;border-radius:8px}
.b-cards{display:flex;flex-direction:column;gap:4px}
.b-card{display:flex;background:var(--color-surface);border:1px solid var(--color-border);border-radius:6px;overflow:hidden;box-shadow:var(--shadow-card);transition:box-shadow .15s,border-color .15s;cursor:pointer}
.b-card:hover{box-shadow:var(--shadow-card-hover);border-color:var(--color-border-strong)}
.b-stripe{width:3px;flex-shrink:0}
.b-body{padding:6px 8px;min-width:0}
.b-call{font-size:.6rem;font-weight:600;letter-spacing:.05em;color:var(--color-text-muted)}
.b-title{font-size:.75rem;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.floor{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 12px 16px}
.ws{display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 6px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:10px;cursor:pointer;box-shadow:var(--shadow-card);transition:box-shadow .15s,border-color .15s,background .15s;position:relative}
.ws:hover{box-shadow:var(--shadow-card-hover);border-color:var(--color-border-strong)}
.ws.active{background:var(--gradient-green-soft);border-color:var(--color-primary)}
.ws-avatar{width:56px;height:56px;border-radius:50%;border:2px solid;display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--color-surface-2)}
.ws-img{width:100%;height:100%;object-fit:cover}
.ws-name{font-size:.65rem;font-weight:700;letter-spacing:.05em;text-align:center}
.ws-status{font-size:.6rem;color:var(--color-text-muted);text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.ws-status.running{color:var(--color-success);font-weight:600}
.ws-status.blocked{color:var(--color-danger)}
.ws-chat-hint{font-size:.55rem;color:var(--color-primary);opacity:0;transition:opacity .15s;position:absolute;bottom:4px}
.ws:hover .ws-chat-hint{opacity:1}
.create-form{display:flex;flex-direction:column;gap:18px}
.modal-footer{display:flex;justify-content:flex-end;gap:8px}
.task-detail{display:flex;flex-direction:column;gap:8px}
.td-row{display:flex;gap:8px;font-size:.85rem}
.td-label{color:var(--color-text-muted);min-width:80px;flex-shrink:0}
.td-val{font-weight:500}
.td-actions{display:flex;gap:6px;flex-wrap:wrap}
.td-sub-modal{display:flex;flex-direction:column;gap:8px;padding:12px;background:var(--color-surface-2);border-radius:8px;margin-top:4px}
.chat-box{display:flex;flex-direction:column;gap:8px;height:100%;overflow-y:auto;padding:4px}
.chat-msg{display:flex}
.chat-msg.user{justify-content:flex-end}
.chat-msg.assistant{justify-content:flex-start}
.chat-bubble{max-width:85%;padding:8px 12px;border-radius:12px;font-size:.85rem;line-height:1.4;white-space:pre-wrap}
.chat-msg.user .chat-bubble{background:var(--color-primary-soft);color:var(--color-text);border-bottom-right-radius:4px}
.chat-msg.assistant .chat-bubble{background:var(--color-surface-2);border:1px solid var(--color-border);border-bottom-left-radius:4px}
.chat-thinking{color:var(--color-text-muted);font-style:italic}
.chat-input-row{display:flex;gap:6px}
.chat-input{flex:1}
.empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:40px 32px;text-align:center;color:var(--color-text-muted);font-size:.85rem}
.empty-ico{font-size:1.75rem;color:var(--color-border-strong)}
</style>
