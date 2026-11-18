import { defaults, defaultShortcuts, settingsForFullHeight } from '../model'
import type { Settings, Shortcut, StickyNote, WidgetId } from '../model'
import { compare, decode, isKey, ITEM_LIMIT, noteKey, SyncQuotaError } from './storage'
import type { Changes, Content, Entry, StorageKey, SyncStorage } from './storage'

type Version = Entry | null
interface Edit { value: Version; base: Version }
interface BoardState {
  notes: StickyNote[]
  settings: Settings
  shortcuts: Shortcut[]
  ready: boolean
  pending: number
  conflicts: StorageKey[]
  error: string
}
type Journal = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const sameVersion = (a: Version, b: Version) => a === b || (!!a && !!b && compare(a, b) === 0)
const sameData = (a: Version, b: Version) => sameVersion(a, b)
  || (!!a && !!b && JSON.stringify(a.data) === JSON.stringify(b.data))

export class Board {
  private readonly writer = crypto.randomUUID()
  private entries = new Map<StorageKey, Entry>()
  private removed = new Map<StorageKey, Entry>()
  private edits = new Map<StorageKey, Edit>()
  private contested = new Set<StorageKey>()
  private listeners = new Set<() => void>()
  private queuedChanges: Changes[] = []
  private timer?: ReturnType<typeof setTimeout>
  private inFlight?: Promise<void>
  private loadTask?: Promise<void>
  private lastStamp = 0
  private state: BoardState = {
    notes: [], settings: defaults, shortcuts: defaultShortcuts, ready: false, pending: 0, conflicts: [], error: '',
  }

  constructor(private readonly storage: SyncStorage, private readonly journal?: Journal) {}

  private get journalKey() { return this.storage.scopedKey('notescape.pending.v1') }

  snapshot = () => this.state

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private notify(patch: Partial<BoardState> = {}) {
    const visible = new Map(this.entries)
    for (const [key, edit] of this.edits) {
      if (edit.value) visible.set(key, edit.value)
      else visible.delete(key)
    }
    const notes = [...visible].filter(([key]) => key.startsWith('note:'))
      .map(([, entry]) => entry.data as StickyNote)
      .sort((a, b) => a.zIndex - b.zIndex || (a.id < b.id ? -1 : 1))
    this.state = {
      ...this.state, ...patch, notes,
      settings: settingsForFullHeight((visible.get('settings')?.data as Settings | undefined) ?? defaults),
      shortcuts: (visible.get('shortcuts')?.data as Shortcut[] | undefined) ?? defaultShortcuts,
      pending: this.edits.size, conflicts: [...this.contested],
    }
    this.listeners.forEach((listener) => listener())
  }

  load = () => {
    if (this.state.ready) return Promise.resolve()
    this.loadTask ??= this.read().finally(() => { this.loadTask = undefined })
    return this.loadTask
  }

  private async read() {
    try {
      const { entries, invalid } = await this.storage.read()
      this.entries = entries
      this.state = { ...this.state, ready: true }
      for (const changes of this.queuedChanges.splice(0)) this.applyChanges(changes)
      this.restoreJournal()
      this.notify({ error: invalid ? 'Một số mục lưu trữ bị lỗi định dạng và không thể hiển thị.' : '' })
      this.schedule()
    } catch {
      this.notify({ error: 'Không thể đọc bộ nhớ Chrome. Hãy thử lại.' })
    }
  }

  private restoreJournal() {
    try {
      const raw = this.journal?.getItem(this.journalKey)
      if (!raw) return
      for (const [key, draft] of Object.entries(JSON.parse(raw) as Record<string, Edit>)) {
        if (!isKey(key) || !draft) continue
        const value = draft.value === null ? null : decode(key, draft.value)
        const base = draft.base === null ? null : decode(key, draft.base)
        if (value === undefined || base === undefined) continue
        const current = this.entries.get(key) ?? null
        if (sameData(current, value)) continue
        this.edits.set(key, { value, base })
        if (!sameVersion(current, base)) this.contested.add(key)
      }
      this.saveJournal()
    } catch {
      // Chrome Sync remains available if tab-local recovery is unavailable.
    }
  }

  private saveJournal() {
    try {
      if (this.edits.size) this.journal?.setItem(this.journalKey, JSON.stringify(Object.fromEntries(this.edits)))
      else this.journal?.removeItem(this.journalKey)
    } catch {
      // A failed recovery write must not clear the live edits.
    }
  }

  receive = (changes: Changes) => {
    if (!this.state.ready && !this.loadTask) return
    const scoped = this.storage.scopedChanges(changes)
    if (!Object.keys(scoped).length) return
    if (!this.state.ready) {
      this.queuedChanges.push(scoped)
      return
    }
    this.applyChanges(scoped)
  }

  private applyChanges(changes: Changes) {
    let updated = false
    for (const [key, change] of Object.entries(changes)) {
      if (!isKey(key)) continue
      const incoming = change.newValue === undefined ? null : decode(key, change.newValue)
      if (incoming === undefined) continue
      const current = this.entries.get(key) ?? null
      const previous = decode(key, change.oldValue)
      const floor = current ?? this.removed.get(key)
      if (incoming && floor && compare(incoming, floor) <= 0) continue
      if (incoming === null && (!current || (previous && compare(previous, current) < 0))) continue
      const edit = this.edits.get(key)
      if (incoming?.writer === this.writer && this.contested.has(key)) continue
      if (incoming) {
        this.entries.set(key, incoming)
        this.removed.delete(key)
      } else if (current) {
        this.entries.delete(key)
        this.removed.set(key, previous ?? current)
      }
      if (edit && !sameVersion(edit.base, incoming) && !sameData(edit.value, incoming)) {
        if (incoming?.writer === this.writer) edit.base = incoming
        else this.contested.add(key)
        this.saveJournal()
      }
      updated = true
    }
    if (updated) this.notify()
  }

  private stage(key: StorageKey, data: Content | null) {
    const current = this.entries.get(key) ?? null
    const prior = this.edits.get(key)
    const latestStamp = current?.updatedAt ?? this.removed.get(key)?.updatedAt ?? 0
    this.lastStamp = Math.max(Date.now(), this.lastStamp + 1, latestStamp + 1)
    const value = data === null ? null : { data, updatedAt: this.lastStamp, writer: this.writer }
    this.edits.set(key, { value, base: prior ? prior.base : current })
  }

  private changed() {
    this.saveJournal()
    this.notify()
    this.schedule()
  }

  private schedule() {
    clearTimeout(this.timer)
    if ([...this.edits.keys()].some((key) => !this.contested.has(key))) {
      this.timer = setTimeout(() => { void this.flush() }, 2_000)
    }
  }

  setNote = (note: StickyNote) => {
    this.stage(noteKey(note.id), note)
    this.changed()
  }

  updateNote = (id: string, patch: Partial<Omit<StickyNote, 'id' | 'createdAt'>>) => {
    const note = this.state.notes.find((item) => item.id === id)
    if (note && Object.entries(patch).some(([key, value]) => note[key as keyof StickyNote] !== value)) {
      this.setNote({ ...note, ...patch })
    }
  }

  moveNotes = (positions: ReadonlyMap<string, Pick<StickyNote, 'x' | 'y'>>) => {
    let moved = 0
    for (const note of this.state.notes) {
      const point = positions.get(note.id)
      if (!point || note.locked || (point.x === note.x && point.y === note.y)) continue
      this.stage(noteKey(note.id), { ...note, ...point })
      moved++
    }
    if (moved) this.changed()
    return moved
  }

  deleteNote = (id: string) => {
    this.stage(noteKey(id), null)
    this.changed()
  }

  updateSettings = (patch: Partial<Settings>) => {
    this.stage('settings', { ...this.state.settings, ...patch })
    this.changed()
  }

  setWidgetVisibility = (widget: WidgetId, visible: boolean) => {
    this.updateSettings({ widgetVisibility: { ...this.state.settings.widgetVisibility, [widget]: visible } })
  }

  setShortcuts = (shortcuts: Shortcut[]) => {
    this.stage('shortcuts', shortcuts)
    this.changed()
  }

  importBackup = (backup: { notes: StickyNote[]; settings: Settings; shortcuts: Shortcut[] }) => {
    for (const note of backup.notes) this.stage(noteKey(note.id), note)
    this.stage('settings', backup.settings)
    this.stage('shortcuts', backup.shortcuts)
    this.changed()
  }

  resolve = async (key: StorageKey, keepEdit: boolean) => {
    await this.inFlight
    const edit = this.edits.get(key)
    if (!edit || !this.contested.has(key)) return
    this.edits.delete(key)
    this.contested.delete(key)
    // Either version may need to be written back if a save raced the remote event.
    this.stage(key, keepEdit ? edit.value?.data ?? null : this.entries.get(key)?.data ?? null)
    this.changed()
    await this.flush()
  }

  flush = async () => {
    if (this.inFlight) {
      await this.inFlight
      return
    }
    clearTimeout(this.timer)
    this.inFlight = this.persist().finally(() => { this.inFlight = undefined })
    await this.inFlight
  }

  private async persist() {
    const pending = [...this.edits].filter(([key]) => !this.contested.has(key))
    if (!pending.length) return
    const oversized = pending.some(([key, { value }]) => value && this.storage.bytes(key, value) > ITEM_LIMIT)
    const deletes = pending.filter(([, edit]) => !edit.value)
    const writes = pending.filter(([key, { value }]) => value && this.storage.bytes(key, value) <= ITEM_LIMIT)
    const started = new Map(this.edits)
    let error = oversized ? 'Một mục gần hoặc vượt 8 KB. Hãy xuất JSON hoặc rút ngắn nội dung rồi thử lưu lại.' : ''
    for (const batch of [deletes, writes]) {
      if (!batch.length) continue
      try {
        const eligible = batch.filter(([key, edit]) => this.edits.get(key) === edit && !this.contested.has(key))
        if (!eligible.length) continue
        if (batch === deletes) await this.storage.delete(eligible.map(([key]) => key))
        else await this.storage.write(Object.fromEntries(eligible.map(([key, edit]) => [key, edit.value!])))
        for (const [key, edit] of eligible) {
          // Storage change notifications can run before or after the write promise.
          // Preserve any remote version received while this write was in flight.
          if (this.contested.has(key)) continue
          const current = this.entries.get(key) ?? null
          if (edit.value && (!current || compare(edit.value, current) > 0)) this.entries.set(key, edit.value)
          if (!edit.value && current) {
            this.removed.set(key, current)
            this.entries.delete(key)
          }
          const latest = this.edits.get(key)
          if (latest === edit) this.edits.delete(key)
          else if (latest) latest.base = this.entries.get(key) ?? null
        }
      } catch (failure) {
        error = failure instanceof SyncQuotaError ? failure.message
          : /QUOTA|MAX_WRITE/i.test(String(failure))
            ? 'Chrome đã giới hạn thao tác lưu. Hãy chờ rồi thử lại hoặc xuất JSON để sao lưu.'
            : 'Chrome chưa thể lưu thay đổi. Hãy thử lại hoặc xuất JSON để sao lưu.'
      }
    }
    this.saveJournal()
    this.notify({ error })
    if ([...this.edits].some(([key, edit]) => started.get(key) !== edit)) this.schedule()
  }

  stop = () => {
    clearTimeout(this.timer)
  }
}
