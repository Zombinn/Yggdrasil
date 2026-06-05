import type { Mission, MissionMessage, MissionEvent, ThoughtStep } from '~/types/mission'

export function useMissionStream() {
  const mission = useState<Mission | null>('mission.active', () => null)
  const messages = useState<MissionMessage[]>('mission.messages', () => [])
  const streaming = ref(false)
  const connected = ref(false)
  const error = ref<string | null>(null)
  const lastStep = ref<ThoughtStep | null>(null)
  let es: EventSource | null = null
  let pending: MissionMessage | null = null

  function connect(mid: string) {
    if (es) return
    const src = new EventSource("/api/missions/" + mid + "/stream")
    src.addEventListener('open', () => connected.value = true)
    src.addEventListener('error', () => connected.value = false)
    const h = (raw: MessageEvent) => {
      let ev: MissionEvent; try { ev = JSON.parse(raw.data) } catch { return }
      if (ev.type === 'chunk') {
        if (!pending) { pending = { id: -1, role: 'assistant', content: '', createdAt: new Date().toISOString(), pending: true }; messages.value = [...messages.value, pending] }
        pending.content += ev.delta || ''; messages.value = [...messages.value]; streaming.value = true
      } else if (ev.type === 'done') {
        if (pending) { pending.id = ev.messageId || 0; pending.content = ev.content || ''; pending.pending = false; messages.value = [...messages.value]; pending = null }
        streaming.value = false; lastStep.value = null
      } else if (ev.type === 'error') { error.value = ev.message || 'Error'; streaming.value = false }
    }
    src.addEventListener('chunk', h); src.addEventListener('done', h); src.addEventListener('error', h)
    es = src
  }
  return { mission, messages, streaming, connected, error, lastStep, connect }
}
