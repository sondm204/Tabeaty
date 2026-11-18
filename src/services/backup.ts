import { isNote, isSettings, isShortcuts, record } from './validation'
import { ITEM_COUNT, ITEM_LIMIT, SOFT_TOTAL, itemBytes, noteKey } from './storage'
import type { Settings, Shortcut, StickyNote } from '../model'

export interface Backup { notes: StickyNote[]; settings: Settings; shortcuts: Shortcut[] }

export function serializeBackup(backup: Backup) {
  return JSON.stringify({
    format: 'notescape', version: 1, notes: backup.notes,
    settings: backup.settings, shortcuts: backup.shortcuts,
  }, null, 2)
}

export function parseBackup(json: string): Backup {
  const value: unknown = JSON.parse(json)
  if (!record(value) || value.format !== 'notescape' || value.version !== 1
    || !Array.isArray(value.notes) || value.notes.length > ITEM_COUNT - 2 || !value.notes.every(isNote)
    || !isSettings(value.settings) || !isShortcuts(value.shortcuts)) {
    throw new Error('Tệp không đúng định dạng bản sao lưu NoteScape.')
  }
  if (new Set(value.notes.map((note) => note.id)).size !== value.notes.length) {
    throw new Error('Tệp có ghi chú trùng mã định danh.')
  }
  const items = [
    ['settings', value.settings], ['shortcuts', value.shortcuts],
    ...value.notes.map((note) => [noteKey(note.id), note] as const),
  ] as const
  const sizes = items.map(([key, data]) => itemBytes(key, {
    updatedAt: Number.MAX_SAFE_INTEGER, writer: '00000000-0000-0000-0000-000000000000', data,
  }))
  if (sizes.some((size) => size > ITEM_LIMIT) || sizes.reduce((a, b) => a + b, 0) > SOFT_TOTAL) {
    throw new Error('Bản sao lưu vượt dung lượng Chrome Sync. Hãy giữ tệp gốc và rút ngắn nội dung trong bản sao trước khi nhập.')
  }
  return { notes: value.notes, settings: value.settings, shortcuts: value.shortcuts }
}
