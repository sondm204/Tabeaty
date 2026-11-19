import { AlertCircle, LoaderCircle, Image, Move, NotebookPen, Plus, Settings2 } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import { IconButton } from './components/Controls'
import { Note } from './components/Notes'
import { exportBackup, Modal, SettingsPanel } from './components/Settings'
import type { Confirmation, SettingsSection, WidgetTarget } from './components/Settings'
import { Wallpaper, useWallpaper } from './components/Wallpaper'
import { DashboardWidgets, ShortcutWidget } from './components/Widgets'
import { TimerWidgets } from './components/Timers'
import { WorkspacePicker } from './components/WorkspacePicker'
import { createNote, noteRect, widgetVisible } from './model'
import type { Rect, Size } from './model'
import { snapPosition, snapResize, viewportCenter, viewportGuides } from './snap'
import type { ResizeDirection, SnapGuides } from './snap'
import { Board } from './services/board'
import { SyncStorage, noteKey } from './services/storage'
import type { Changes, StorageKey } from './services/storage'
import { useWorkspaceDirectory } from './services/workspace-directory'
import type { WorkspaceDirectory } from './services/workspace-directory'
import { firstWorkspace, readWorkspaceSelection, rememberWorkspace, workspaceSlots } from './workspaces'
import type { Workspace, WorkspaceSlot } from './workspaces'
import { fitBoard } from './board-layout'

function viewportSize(): Size {
  return { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight }
}

function createBoards() {
  let journal: Storage | undefined
  try { journal = window.sessionStorage } catch { /* Tab-local recovery is optional. */ }
  return new Map(workspaceSlots.map((slot) => [slot, new Board(new SyncStorage(chrome.storage.sync, slot), journal)]))
}

export function App() {
  const [boards] = useState(createBoards)
  const [preferred, setPreferred] = useState(readWorkspaceSelection)
  const directory = useWorkspaceDirectory()
  const active = directory.workspaces.find((workspace) => workspace.slot === preferred) ?? firstWorkspace
  const board = boards.get(active.slot)!

  useEffect(() => {
    const incoming = (changes: Changes, areaName: string) => {
      if (areaName === 'sync') for (const board of boards.values()) board.receive(changes)
    }
    const flush = () => { for (const board of boards.values()) void board.flush() }
    const hidden = () => { if (document.hidden) flush() }
    chrome.storage.onChanged.addListener(incoming)
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', flush)
      chrome.storage.onChanged.removeListener(incoming)
      for (const board of boards.values()) board.stop()
    }
  }, [boards])

  function select(slot: WorkspaceSlot) {
    if (slot !== active.slot) void board.flush()
    setPreferred(slot)
    rememberWorkspace(slot)
  }

  return <Dashboard key={active.slot} board={board} workspace={active} directory={directory} selectWorkspace={select} />
}

function Dashboard({ board, workspace, directory, selectWorkspace }: {
  board: Board; workspace: Workspace; directory: WorkspaceDirectory; selectWorkspace: (slot: WorkspaceSlot) => void
}) {
  const state = useSyncExternalStore(board.subscribe, board.snapshot)
  const showNotes = widgetVisible(state.settings, 'notes')
  const { images, loading, failed, refresh } = useWallpaper()
  const [section, setSection] = useState<SettingsSection | null>(null)
  const [widgetTarget, setWidgetTarget] = useState<WidgetTarget | null>(null)
  const [focus, setFocus] = useState('')
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [area, setArea] = useState<Size>({ width: 0, height: 0 })
  const [viewport, setViewport] = useState(viewportSize)
  const [guides, setGuides] = useState<SnapGuides>({})
  const [editingWidgets, setEditingWidgets] = useState(false)
  const canvas = useRef<HTMLDivElement>(null)
  const reference = state.settings.layoutReference
  const fitted = reference && viewport.width && viewport.height ? fitBoard(reference, viewport) : undefined
  const scale = fitted?.scale ?? 1
  const stageStyle = fitted ? {
    width: fitted.width, height: fitted.height, left: fitted.x, top: fitted.y, right: 'auto', bottom: 'auto',
    transform: `scale(${scale})`, '--board-vw': `${fitted.width / 100}px`,
  } as CSSProperties : undefined

  useLayoutEffect(() => {
    const element = canvas.current!
    const measure = () => {
      const width = element.clientWidth
      const height = element.clientHeight
      setArea((previous) => previous.width === width && previous.height === height ? previous : { width, height })
      const next = viewportSize()
      setViewport((previous) => previous.width === next.width && previous.height === next.height ? previous : next)
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
    void board.load()
  }, [board])

  useEffect(() => {
    if (!editingWidgets) return
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('dialog[open]')) setEditingWidgets(false)
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [editingWidgets])

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

  const findSnap = useCallback((id: string, rect: Rect, direction?: ResizeDirection) => {
    const origin = canvas.current?.getBoundingClientRect()
    if (!origin) return { rect, guides: {} }
    const center = viewportCenter(origin, viewport, scale)
    const neighbors = board.snapshot().notes.filter((note) => note.id !== id).map((note) => noteRect(note, area))
    if (direction) {
      const snapped = snapResize(rect, area, neighbors, direction, center, scale)
      return { rect: snapped.rect, guides: viewportGuides(snapped.guides, origin, scale) }
    }
    const { position, guides } = snapPosition(rect, rect, area, neighbors, center, scale)
    return { rect: { ...rect, ...position }, guides: viewportGuides(guides, origin, scale) }
  }, [area, board, scale, viewport])

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
  const editWeather = useCallback(() => {
    if (!state.ready) return
    setWidgetTarget('weather')
    setSection('widgets')
  }, [state.ready])
  const editTimers = useCallback(() => {
    setWidgetTarget('countdown')
    setSection('widgets')
  }, [])
  const selectSettings = (next: SettingsSection | null) => {
    setWidgetTarget(null)
    setSection(next)
  }
  const editShortcuts = useCallback(() => {
    if (!state.ready) return
    setWidgetTarget('shortcuts')
    setSection('widgets')
  }, [state.ready])
  const showConflicts = () => { if (state.conflicts[0]) resolve(state.conflicts[0]) }
  const run = (action: () => void) => {
    setConfirmation(null)
    action()
  }

  return <main className="dashboard">
    <Wallpaper images={images} overlay={state.settings.overlay} blur={state.settings.blur} animate={state.settings.animate} />
    <header className="topbar">
      <div className="topbar-start">
        <div className="wordmark"><span className="brand-icon"><NotebookPen size={20} strokeWidth={1.9} /></span><span>NoteScape<span className="brand-dot">.</span></span></div>
        <WorkspacePicker active={workspace} directory={directory} select={selectWorkspace} />
      </div>
      <div className="top-actions">
        <button type="button" className="wallpaper-action glass" disabled={loading} onClick={refresh} aria-label="Đổi hình nền" title="Đổi hình nền">
          {loading ? <LoaderCircle size={17} className="spinner" /> : <Image size={17} />} <span>Đổi hình nền</span>
        </button>
        <IconButton className="settings-action glass" label="Chỉnh bố cục tiện ích" aria-pressed={editingWidgets}
          disabled={!state.ready} onClick={() => setEditingWidgets(!editingWidgets)}><Move size={17} /></IconButton>
        <IconButton className="settings-action glass" label="Cài đặt" disabled={!state.ready} onClick={() => setSection('appearance')}><Settings2 size={18} /></IconButton>
      </div>
    </header>

    <div className="board-stage" style={stageStyle}>
      <DashboardWidgets settings={state.settings} ready={state.ready} editCity={editWeather} editing={editingWidgets} update={board.updateSettings}
        setVisibility={board.setWidgetVisibility} showGuides={showGuides} />

      <div ref={canvas} className="canvas" role={showNotes ? 'region' : undefined} aria-label={showNotes ? 'Bảng ghi chú' : undefined}>
        {showNotes && area.width > 0 && area.height > 0 && state.notes.map((note, index) => <Note key={note.id} note={note} area={area} scale={scale}
          layer={index + 1} focus={focus === note.id} conflict={state.conflicts.includes(noteKey(note.id))} update={board.updateNote}
          activate={activate} remove={remove} resolve={resolveNote} findSnap={findSnap} showGuides={showGuides} />)}
      </div>

      {(widgetVisible(state.settings, 'countdown') || widgetVisible(state.settings, 'pomodoro')) &&
        <TimerWidgets settings={state.settings} update={board.updateSettings} configure={editTimers} editing={editingWidgets}
          setVisibility={board.setWidgetVisibility} showGuides={showGuides} />}
      {state.ready && widgetVisible(state.settings, 'shortcuts') &&
        <ShortcutWidget shortcuts={state.shortcuts} position={state.settings.shortcutPosition} edit={editShortcuts}
          editing={editingWidgets} update={board.updateSettings} setVisibility={board.setWidgetVisibility} showGuides={showGuides} />}
    </div>

    {(guides.x !== undefined || guides.y !== undefined) && <div className="snap-guides" aria-hidden="true">
      {guides.x !== undefined && <div className="snap-guide snap-guide-x" style={{ left: guides.x }} />}
      {guides.y !== undefined && <div className="snap-guide snap-guide-y" style={{ top: guides.y }} />}
    </div>}

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

    {showNotes && <footer className="bottom-bar">
      <button type="button" className="add-note" disabled={!state.ready} onClick={addNote}><Plus size={20} /><span>Ghi chú mới</span></button>
    </footer>}

    <SettingsPanel section={section} close={() => selectSettings(null)} select={selectSettings} board={board} state={state} confirm={setConfirmation}
      viewport={viewport} widgetTarget={widgetTarget} showConflicts={showConflicts}
      editWidgetLayout={() => { selectSettings(null); setEditingWidgets(true) }} />
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
