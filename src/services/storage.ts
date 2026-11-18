import { isNote, isSettings, isShortcuts, inRange, record } from './validation'
import type { Settings, Shortcut, StickyNote } from '../model'

export type StorageKey = 'settings' | 'shortcuts' | `note:${string}`
export type Content = Settings | Shortcut[] | StickyNote
export interface Entry { updatedAt: number; writer: string; data: Content }
export type Changes = Record<string, { oldValue?: unknown; newValue?: unknown }>
export interface SyncArea {
  get(keys: null): Promise<Record<string, unknown>>
  getBytesInUse(keys: string[]): Promise<number>
  set(items: Record<string, Entry>): Promise<void>
  remove(keys: string[]): Promise<void>
}

export const ITEM_LIMIT = 7_900
export const SOFT_TOTAL = 100_000
export const ITEM_COUNT = 512
export const noteKey = (id: string): StorageKey => `note:${id}`
export const itemBytes = (key: string, value: unknown) =>
  new TextEncoder().encode(key + JSON.stringify(value)).byteLength

export class SyncQuotaError extends Error {}

export function isKey(key: string): key is StorageKey {
  return key === 'settings' || key === 'shortcuts' || /^note:[\w-]{1,80}$/.test(key)
}

export function decode(key: StorageKey, value: unknown): Entry | undefined {
  if (!record(value) || !inRange(value.updatedAt, 0, Number.MAX_SAFE_INTEGER)
    || typeof value.writer !== 'string' || !/^[\w-]{1,80}$/.test(value.writer)) return
  const data = value.data
  const valid = key === 'settings' ? isSettings(data)
    : key === 'shortcuts' ? isShortcuts(data) : isNote(data) && noteKey(data.id) === key
  if (valid) return { updatedAt: value.updatedAt, writer: value.writer, data: data as Content }
}

export function compare(a: Entry, b: Entry) {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt
  return a.writer === b.writer ? 0 : a.writer > b.writer ? 1 : -1
}

export class SyncStorage {
  constructor(private readonly area: SyncArea) {}

  async read() {
    const entries = new Map<StorageKey, Entry>()
    let invalid = 0
    for (const [key, value] of Object.entries(await this.area.get(null))) {
      if (!isKey(key)) continue
      const entry = decode(key, value)
      if (entry) entries.set(key, entry)
      else invalid++
    }
    return { entries, invalid }
  }

  delete(keys: string[]) {
    return this.area.remove(keys)
  }

  async write(items: Record<string, Entry>) {
    const entries = Object.entries(items)
    if (!entries.length) return
    if (entries.some(([key, entry]) => itemBytes(key, entry) > ITEM_LIMIT)) {
      throw new SyncQuotaError('Một mục vượt giới hạn khoảng 8 KB. Hãy xuất JSON hoặc rút ngắn nội dung rồi lưu lại.')
    }
    const keys = entries.map(([key]) => key)
    const all = await this.area.get(null)
    const existing = Object.keys(all)
    const newKeys = keys.filter((key) => !Object.hasOwn(all, key))
    if (existing.length + newKeys.length > ITEM_COUNT) throw new SyncQuotaError('Đã đạt giới hạn số mục của Chrome Sync. Hãy sao lưu rồi xóa bớt mục.')
    const [total, replaced] = await Promise.all([this.area.getBytesInUse(existing), this.area.getBytesInUse(keys)])
    const projected = total - replaced + entries.reduce((sum, [key, entry]) => sum + itemBytes(key, entry), 0)
    if (projected > SOFT_TOTAL && projected >= total) {
      throw new SyncQuotaError('Dung lượng Chrome Sync gần đầy. Hãy sao lưu JSON và xóa bớt ghi chú để tiếp tục đồng bộ.')
    }
    await this.area.set(items)
  }
}
