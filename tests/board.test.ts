import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNote, defaults, noteRect, relativePoint } from '../src/model'
import { Board } from '../src/services/board'
import { itemBytes, noteKey, SyncStorage } from '../src/services/storage'
import type { Changes, Entry, SyncArea } from '../src/services/storage'

class MemorySync implements SyncArea {
  data: Record<string, Entry> = {}
  listeners: ((changes: Changes) => void)[] = []
  rejected = false

  get = vi.fn(async () => ({ ...this.data }))
  getBytesInUse = vi.fn(async (keys: string[]) => keys.reduce(
    (sum, key) => sum + (this.data[key] ? itemBytes(key, this.data[key]) : 0), 0,
  ))

  set = vi.fn(async (items: Record<string, Entry>) => {
    if (this.rejected) throw new Error('QUOTA_BYTES quota exceeded')
    const changes: Changes = {}
    for (const [key, value] of Object.entries(items)) {
      changes[key] = { oldValue: this.data[key], newValue: value }
      this.data[key] = value
    }
    this.listeners.forEach((receive) => receive(changes))
  })

  remove = vi.fn(async (keys: string[]) => {
    const changes: Changes = {}
    for (const key of keys) {
      if (!this.data[key]) continue
      changes[key] = { oldValue: this.data[key] }
      delete this.data[key]
    }
    this.listeners.forEach((receive) => receive(changes))
  })
}

const fixture = () => createNote(defaults, { x: .8, y: .65 }, 1)

describe('Bảng ghi chú và Chrome Sync', () => {
  let area: MemorySync
  let board: Board
  beforeEach(async () => {
    vi.useFakeTimers()
    area = new MemorySync()
    board = new Board(new SyncStorage(area))
    area.listeners.push(board.receive)
    await board.load()
  })
  afterEach(() => {
    board.stop()
    vi.useRealTimers()
  })

  it('tạo đúng mặc định, gộp nhiều lần nhập và khôi phục nội dung qua một phiên mới', async () => {
    const note = fixture()
    expect(note).toMatchObject({ width: 300, height: 240, content: '', title: '', locked: false })
    expect(fixture().id).not.toBe(note.id)
    board.setNote(note)
    board.updateNote(note.id, { title: 'Cuộc họp', content: 'Dòng 1' })
    await vi.advanceTimersByTimeAsync(1_500)
    board.updateNote(note.id, { content: 'Dòng 1\nDòng 2' })
    await vi.advanceTimersByTimeAsync(1_999)
    expect(area.set).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(area.set).toHaveBeenCalledTimes(1)
    const restored = new Board(new SyncStorage(area))
    await restored.load()
    expect(restored.snapshot().notes[0]).toEqual({ ...note, title: 'Cuộc họp', content: 'Dòng 1\nDòng 2' })
    expect(board.snapshot().pending).toBe(0)
  })

  it('xóa ghi chú và cập nhật ở tab khác, bỏ qua một sự kiện cũ đến trễ', async () => {
    const note = fixture()
    const second = new Board(new SyncStorage(area))
    area.listeners.push(second.receive)
    await second.load()
    board.setNote(note)
    await board.flush()
    const key = noteKey(note.id)
    const old = area.data[key]
    expect(second.snapshot().notes).toEqual([note])
    board.deleteNote(note.id)
    await board.flush()
    expect(second.snapshot().notes).toEqual([])
    second.receive({ [key]: { newValue: old } })
    expect(second.snapshot().notes).toEqual([])
  })

  it('giữ bản đang sửa khi có cập nhật từ tab khác và lưu lựa chọn của người dùng', async () => {
    const note = fixture()
    board.setNote(note)
    await board.flush()
    const second = new Board(new SyncStorage(area))
    area.listeners.push(second.receive)
    await second.load()
    board.updateNote(note.id, { content: 'Bản nháp' })
    second.updateNote(note.id, { content: 'Bản từ tab khác' })
    await second.flush()
    const key = noteKey(note.id)
    expect(board.snapshot().conflicts).toEqual([key])
    expect(board.snapshot().notes[0]?.content).toBe('Bản nháp')
    await board.flush()
    expect(second.snapshot().notes[0]?.content).toBe('Bản từ tab khác')
    await board.resolve(key, true)
    expect(second.snapshot().notes[0]?.content).toBe('Bản nháp')
    expect(board.snapshot().conflicts).toEqual([])
  })

  it('cho phép chấp nhận thao tác xóa từ xa trong khi đang chỉnh nội dung', async () => {
    const note = fixture()
    board.setNote(note)
    await board.flush()
    const second = new Board(new SyncStorage(area))
    area.listeners.push(second.receive)
    await second.load()
    board.updateNote(note.id, { content: 'Bản nháp' })
    second.deleteNote(note.id)
    await second.flush()
    expect(board.snapshot().notes[0]?.content).toBe('Bản nháp')
    await board.resolve(noteKey(note.id), false)
    expect(board.snapshot().notes).toEqual([])
  })

  it('giữ nội dung vượt giới hạn mục và vẫn lưu các ghi chú đủ nhỏ', async () => {
    const long = { ...fixture(), content: 'ế🌱'.repeat(1300) }
    const short = fixture()
    board.setNote(long)
    board.setNote(short)
    await board.flush()
    expect(Object.keys(area.data)).toEqual([noteKey(short.id)])
    expect(board.snapshot().notes.find(({ id }) => id === long.id)?.content).toBe(long.content)
    expect(board.snapshot().pending).toBe(1)
    expect(board.snapshot().error).toContain('8 KB')
  })

  it('chặn ghi trước khi vượt giới hạn tổng mà vẫn giữ ghi chú trong tab', async () => {
    for (let i = 0; i < 14; i++) {
      const note = { ...fixture(), content: 'x'.repeat(7100) }
      area.data[noteKey(note.id)] = { data: note, updatedAt: i, writer: 'test' }
    }
    board.setNote(fixture())
    await board.flush()
    expect(area.set).not.toHaveBeenCalled()
    expect(board.snapshot().error).toContain('gần đầy')
    expect(board.snapshot().pending).toBe(1)
  })

  it('giữ bản nháp nếu Chrome từ chối và cho phép tải lại tab rồi lưu lại', async () => {
    const journal = new Map<string, string>()
    const storage = {
      getItem: (key: string) => journal.get(key) ?? null,
      setItem: (key: string, value: string) => { journal.set(key, value) },
      removeItem: (key: string) => { journal.delete(key) },
    }
    const old = new Board(new SyncStorage(area), storage)
    await old.load()
    const note = { ...fixture(), content: 'Bản nháp' }
    old.setNote(note)
    area.rejected = true
    await old.flush()
    expect(old.snapshot()).toMatchObject({ notes: [note], pending: 1, error: expect.stringContaining('giới hạn') })
    old.stop()
    const restored = new Board(new SyncStorage(area), storage)
    await restored.load()
    expect(restored.snapshot().notes).toEqual([note])
    area.rejected = false
    await restored.flush()
    expect(restored.snapshot()).toMatchObject({ pending: 0, error: '' })
    expect(journal.size).toBe(0)
  })

  it('gỡ timer khi đóng bảng', async () => {
    board.setNote(fixture())
    board.stop()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(area.set).not.toHaveBeenCalled()
  })
})

it('đưa tọa độ tương đối về vùng khả dụng mới mà không sửa kích thước đã lưu', () => {
  const note = fixture()
  const area = { width: 220, height: 210 }
  expect(noteRect(note, area)).toEqual({ x: 0, y: 0, width: 220, height: 210 })
  expect(relativePoint({ x: 0, y: 0 }, area, area, note)).toEqual({ x: .8, y: .65 })
  expect(noteRect(note, { width: 1300, height: 900 })).toMatchObject({ x: 800, width: 300, height: 240 })
})
