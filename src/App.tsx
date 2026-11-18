import { AlertCircle, Check, LoaderCircle, Image, NotebookPen, Plus, Settings2 } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { IconButton } from './components/Controls'
import { Note } from './components/Notes'
import { exportBackup, Modal, SettingsPanel } from './components/Settings'
import type { Confirmation, SettingsSection } from './components/Settings'
import { Wallpaper, useWallpaper } from './components/Wallpaper'
import { DashboardWidgets, ShortcutDock } from './components/Widgets'
import { createNote, noteRect } from './model'
import type { Point, Size } from './model'
import { snapNote } from './snap'
import type { SnapGuides } from './snap'
import { Board } from './services/board'
import { SyncStorage, noteKey } from './services/storage'
import type { Changes, StorageKey } from './services/storage'

function createBoard() {
  let journal: Storage | undefined
  try { journal = window.sessionStorage } catch { /* Tab-local recovery is optional. */ }
  return new Board(new SyncStorage(chrome.storage.sync), journal)
}

export function App() {
  const [board] = useState(createBoard)
  const state = useSyncExternalStore(board.subscribe, board.snapshot)
  const { images, loading, failed, refresh } = useWallpaper()
  const [section, setSection] = useState<SettingsSection | null>(null)
  const [focus, setFocus] = useState('')
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [area, setArea] = useState<Size>({ width: 0, height: 0 })
  const [guides, setGuides] = useState<SnapGuides>({})
  const canvas = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = canvas.current!
    const measure = () => {
      const width = element.clientWidth
      const height = element.clientHeight
      setArea((previous) => previous.width === width && previous.height === height ? previous : { width, height })
    }
    const observer = new ResizeObserver(measure)
    measure()
    observer.observe(element)
    window.addEventListener('resize', measure)
    document.addEventListener('visibilitychange', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
      document.removeEventListener('visibilitychange', measure)
    }
  }, [])

  useEffect(() => {
    const incoming = (changes: Changes, areaName: string) => { if (areaName === 'sync') board.receive(changes) }
    const flush = () => { void board.flush() }
    const hidden = () => { if (document.hidden) flush() }
    chrome.storage.onChanged.addListener(incoming)
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', flush)
    void board.load()
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', flush)
      chrome.storage.onChanged.removeListener(incoming)
      board.stop()
    }
  }, [board])

  function addNote() {
    const { notes, settings } = board.snapshot()
    const offset = notes.length % 7 * .045
    const note = createNote(settings, { x: .4 + offset, y: .36 + offset }, (notes.at(-1)?.zIndex ?? 0) + 1)
    board.setNote(note)
    setFocus(note.id)
  }

  const activate = useCallback((id: string) => {
    const highest = board.snapshot().notes.at(-1)
    if (highest && highest.id !== id) board.updateNote(id, { zIndex: highest.zIndex + 1 })
  }, [board])

  const findSnap = useCallback((id: string, point: Point, size: Size) => {
    const neighbors = board.snapshot().notes.filter((note) => note.id !== id).map((note) => noteRect(note, area))
    return snapNote(point, size, area, neighbors)
  }, [area, board])

  const showGuides = useCallback((next: SnapGuides) => {
    setGuides((previous) => previous.x === next.x && previous.y === next.y ? previous : next)
  }, [])

  const remove = useCallback((id: string) => {
    const note = board.snapshot().notes.find((item) => item.id === id)
    if (!note) return
    setConfirmation({
      title: 'Xóa ghi chú?', text: note.title.trim() ? `“${note.title}” sẽ bị xóa khỏi bảng ghi chú.` : 'Ghi chú này sẽ bị xóa khỏi bảng.',
      action: 'Xóa ghi chú', destructive: true, run: () => board.deleteNote(id),
    })
  }, [board])

  const resolve = useCallback((key: StorageKey) => {
    const label = key === 'settings' ? 'Cài đặt' : key === 'shortcuts' ? 'Lối tắt' : 'Ghi chú'
    setConfirmation({
      title: `${label} có hai phiên bản`,
      text: 'Một tab hoặc thiết bị khác đã lưu thay đổi trong lúc bạn chỉnh sửa. Hãy chọn phiên bản bạn muốn giữ.',
      action: 'Giữ bản của tôi', run: () => { void board.resolve(key, true) },
      alternate: { label: 'Dùng bản từ tab khác', run: () => { void board.resolve(key, false) } },
    })
  }, [board])

  const resolveNote = useCallback((id: string) => resolve(noteKey(id)), [resolve])
  const editWeather = useCallback(() => { if (state.ready) setSection('weather') }, [state.ready])
  const editShortcuts = useCallback(() => { if (state.ready) setSection('shortcuts') }, [state.ready])
  const showConflicts = () => { if (state.conflicts[0]) resolve(state.conflicts[0]) }
  const run = (action: () => void) => {
    setConfirmation(null)
    action()
  }

  return <main className="dashboard">
    <Wallpaper images={images} overlay={state.settings.overlay} blur={state.settings.blur} animate={state.settings.animate} />
    <header className="topbar">
      <div className="wordmark"><span className="brand-icon"><NotebookPen size={20} strokeWidth={1.9} /></span><span>NoteScape<span className="brand-dot">.</span></span></div>
      <div className="top-actions">
        <button type="button" className="wallpaper-action glass" disabled={loading} onClick={refresh} aria-label="Đổi hình nền" title="Đổi hình nền">
          {loading ? <LoaderCircle size={17} className="spinner" /> : <Image size={17} />} <span>Đổi hình nền</span>
        </button>
        <IconButton className="settings-action glass" label="Cài đặt" disabled={!state.ready} onClick={() => setSection('appearance')}><Settings2 size={18} /></IconButton>
      </div>
    </header>

    <DashboardWidgets settings={state.settings} editCity={editWeather} />

    <div ref={canvas} className="canvas" role="region" aria-label="Bảng ghi chú">
      {area.width > 0 && area.height > 0 && state.notes.map((note, index) => <Note key={note.id} note={note} area={area} layer={index + 1}
        focus={focus === note.id} conflict={state.conflicts.includes(noteKey(note.id))} update={board.updateNote}
        activate={activate} remove={remove} resolve={resolveNote} findSnap={findSnap} showGuides={showGuides} />)}
      {(guides.x !== undefined || guides.y !== undefined) && <div className="snap-guides" aria-hidden="true">
        {guides.x !== undefined && <div className="snap-guide snap-guide-x" style={{ left: guides.x }} />}
        {guides.y !== undefined && <div className="snap-guide snap-guide-y" style={{ top: guides.y }} />}
      </div>}
    </div>

    {(state.error || state.conflicts.length > 0 || failed) && <div className="notifications">
      {state.error && <div className="notice glass" role="alert">
        <AlertCircle size={17} /><div>{state.error}<div className="notice-actions">
          <button type="button" onClick={() => { void (state.ready ? board.flush() : board.load()) }}>Thử lại</button>
          {state.ready && <button type="button" onClick={() => exportBackup(state)}>Xuất JSON</button>}
        </div></div>
      </div>}
      {state.conflicts.length > 0 && <div className="notice glass" role="status"><AlertCircle size={17} />
        <div>Có thay đổi cần xử lý.<div className="notice-actions"><button type="button" onClick={showConflicts}>Xem hai phiên bản</button></div></div>
      </div>}
      {failed && <div className="notice glass" role="status"><Image size={17} /><div>Chưa tải được hình nền.<div className="notice-actions"><button type="button" onClick={refresh}>Thử lại</button></div></div></div>}
    </div>}

    <footer className="bottom-bar">
      <div className="board-info">
        <div><NotebookPen size={15} /> {state.notes.length} ghi chú</div>
        <div className="save-status" role="status">{state.ready && !state.pending && !state.error && <Check size={12} />}
          {state.error ? 'Cần kiểm tra lưu trữ' : !state.ready ? 'Đang mở ghi chú…' : state.conflicts.length ? 'Có xung đột' : state.pending ? 'Chờ lưu' : 'Đã lưu trên trình duyệt'}
        </div>
      </div>
      <ShortcutDock shortcuts={state.shortcuts} edit={editShortcuts} />
      <button type="button" className="add-note" disabled={!state.ready} onClick={addNote}><Plus size={20} /><span>Ghi chú mới</span></button>
    </footer>

    <SettingsPanel section={section} close={() => setSection(null)} select={setSection} board={board} state={state} confirm={setConfirmation} showConflicts={showConflicts} />
    <Modal open={confirmation !== null} close={() => setConfirmation(null)} label={confirmation?.title ?? 'Xác nhận'} className="confirmation-modal">
      {confirmation && <div className="confirmation-inner">
        <h2>{confirmation.title}</h2><p>{confirmation.text}</p>
        <div className="button-row">
          <button type="button" className="secondary-button" autoFocus onClick={() => setConfirmation(null)}>Hủy</button>
          {confirmation.alternate && <button type="button" className="secondary-button" onClick={() => run(confirmation.alternate!.run)}>{confirmation.alternate.label}</button>}
          <button type="button" className={confirmation.destructive ? 'danger-button' : 'primary-button'} onClick={() => run(confirmation.run)}>{confirmation.action}</button>
        </div>
      </div>}
    </Modal>
  </main>
}
