import { ArrowDown, ArrowUp, Download, Globe2, Link2, MapPin, NotebookPen, Plus, Search, SlidersHorizontal, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { defaults, MAX_HEIGHT, MAX_SHORTCUTS, MAX_WIDTH, MIN_HEIGHT, MIN_WIDTH } from '../model'
import type { City, Shortcut } from '../model'
import { parseBackup, serializeBackup } from '../services/backup'
import type { Backup } from '../services/backup'
import type { Board } from '../services/board'
import { normalizeUrl } from '../services/validation'
import { searchCities } from '../services/weather'
import { IconButton, RangeField } from './Controls'

const sections = [
  ['appearance', 'Giao diện', SlidersHorizontal], ['notes', 'Ghi chú', NotebookPen],
  ['weather', 'Thời tiết', MapPin], ['shortcuts', 'Lối tắt', Link2], ['general', 'Đồng bộ', Globe2],
] as const
export type SettingsSection = (typeof sections)[number][0]
export interface Confirmation { title: string; text: string; action: string; run: () => void; destructive?: boolean; alternate?: { label: string; run: () => void } }

export function Modal({ open, close, children, label, className }: {
  open: boolean; close: () => void; children: ReactNode; label: string; className: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const node = dialog.current
    if (open && !node?.open) node?.showModal()
    else if (!open && node?.open) node.close()
  }, [open])
  return <dialog ref={dialog} className={className} aria-label={label}
    onCancel={(event) => { event.preventDefault(); close() }}
    onClick={(event) => { if (event.target === event.currentTarget) close() }}>
    {open && children}
  </dialog>
}

function CityForm({ city, select }: { city: City; select: (city: City) => void }) {
  const [query, setQuery] = useState('')
  const [cities, setCities] = useState<City[]>([])
  const [status, setStatus] = useState('')
  const request = useRef<AbortController>(null)
  useEffect(() => () => request.current?.abort(), [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = query.trim()
    request.current?.abort()
    setCities([])
    if (value.length < 2) {
      setStatus('Nhập ít nhất 2 ký tự để tìm thành phố.')
      return
    }
    const controller = new AbortController()
    request.current = controller
    setStatus('Đang tìm…')
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const results = await searchCities(value, controller.signal)
      if (request.current !== controller) return
      setCities(results)
      setStatus(results.length ? '' : 'Không tìm thấy thành phố. Hãy thử tên khác.')
    } catch {
      if (request.current === controller) setStatus('Không thể tìm thành phố lúc này. Hãy thử lại.')
    } finally {
      clearTimeout(timeout)
    }
  }

  return <div className="section-stack">
    <div className="location-card"><MapPin size={20} /><div><strong>{city.name}</strong>{city.country && <span>{city.country}</span>}</div></div>
    <form className="city-form" onSubmit={(event) => { void submit(event) }}>
      <label>Tìm thành phố<input value={query} maxLength={150} placeholder="Nhập tên thành phố" onChange={(event) => setQuery(event.target.value)} /></label>
      <button type="submit" className="secondary-button"><Search size={16} /> Tìm</button>
    </form>
    {status && <p className="form-hint" role="status">{status}</p>}
    {cities.length > 0 && <div className="city-results" aria-label="Kết quả thành phố">
      {cities.map((item) => <button type="button" className="city-result" key={`${item.latitude},${item.longitude}`} onClick={() => {
        select(item)
        setCities([])
        setQuery('')
        setStatus(`Đã chọn ${item.name}.`)
      }}><strong>{item.name}</strong> <span>{item.country} · {item.latitude.toFixed(2)}, {item.longitude.toFixed(2)}</span></button>)}
    </div>}
  </div>
}

function ShortcutForm({ shortcuts, save }: { shortcuts: Shortcut[]; save: (shortcuts: Shortcut[]) => void }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  function edit(shortcut?: Shortcut) {
    setEditing(shortcut?.id ?? '')
    setLabel(shortcut?.label ?? '')
    setUrl(shortcut?.url ?? '')
    setError('')
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    try {
      if (!editing && shortcuts.length >= MAX_SHORTCUTS) throw new Error('Đã đạt giới hạn 24 lối tắt.')
      if (editing && !shortcuts.some((item) => item.id === editing)) throw new Error('Lối tắt này đã bị xóa ở tab khác.')
      const item = { id: editing || crypto.randomUUID(), label: label.trim(), url: normalizeUrl(url) }
      save(editing ? shortcuts.map((shortcut) => shortcut.id === editing ? item : shortcut) : [...shortcuts, item])
      setEditing(null)
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Không thể lưu lối tắt.')
    }
  }

  function move(index: number, step: number) {
    const next = shortcuts.slice()
    const item = next.splice(index, 1)[0]!
    next.splice(index + step, 0, item)
    save(next)
  }

  return <div className="section-stack">
    <ul className="shortcut-manager">
      {shortcuts.map((shortcut, index) => <li key={shortcut.id}>
        <button className="shortcut-edit" type="button" onClick={() => edit(shortcut)} title="Sửa lối tắt">
          <strong>{shortcut.label || new URL(shortcut.url).hostname}</strong>
          <small>{shortcut.url}</small>
        </button>
        <IconButton label={`Đưa ${shortcut.label || 'lối tắt'} lên`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={15} /></IconButton>
        <IconButton label={`Đưa ${shortcut.label || 'lối tắt'} xuống`} disabled={index === shortcuts.length - 1} onClick={() => move(index, 1)}><ArrowDown size={15} /></IconButton>
        <IconButton label={`Xóa ${shortcut.label || 'lối tắt'}`} onClick={() => {
          save(shortcuts.filter((item) => item.id !== shortcut.id))
          if (shortcut.id === editing) setEditing(null)
        }}><Trash2 size={15} /></IconButton>
      </li>)}
    </ul>
    {editing !== null
      ? <form className="field-stack" onSubmit={submit}>
        <label>Tên hiển thị<input value={label} maxLength={40} onChange={(event) => setLabel(event.target.value)} /></label>
        <label>Địa chỉ trang web<input value={url} maxLength={2048} placeholder="https://example.com" required onChange={(event) => setUrl(event.target.value)} /></label>
        {error && <p role="alert" className="form-error">{error}</p>}
        <div className="button-row">
          <button className="primary-button" type="submit">Lưu lối tắt</button>
          <button className="secondary-button" type="button" onClick={() => setEditing(null)}>Hủy</button>
        </div>
      </form>
      : <button className="secondary-button" type="button" disabled={shortcuts.length >= MAX_SHORTCUTS} onClick={() => edit()}><Plus size={17} /> Thêm lối tắt</button>}
  </div>
}

export function exportBackup(data: Backup) {
  const url = URL.createObjectURL(new Blob([serializeBackup(data)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.download = 'notescape.json'
  link.href = url
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function SettingsPanel({ section, close, select, board, state, confirm, showConflicts }: {
  section: SettingsSection | null
  close: () => void
  select: (section: SettingsSection) => void
  board: Board
  state: ReturnType<Board['snapshot']>
  confirm: (value: Confirmation) => void
  showConflicts: () => void
}) {
  const { settings, shortcuts, notes } = state
  const [fileError, setFileError] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const update = board.updateSettings

  async function readBackup(input: HTMLInputElement) {
    const selected = input.files?.[0]
    input.value = ''
    if (!selected) return
    setFileError('')
    try {
      if (selected.size > 2_000_000) throw new Error('Tệp sao lưu quá lớn.')
      const backup = parseBackup(await selected.text())
      confirm({
        title: 'Nhập bản sao lưu?',
        text: `Tệp có ${backup.notes.length} ghi chú. Khi nhập, ghi chú trùng mã, cài đặt và lối tắt sẽ lấy dữ liệu từ tệp.`,
        action: 'Nhập dữ liệu', run: () => board.importBackup(backup),
      })
    } catch (error) {
      setFileError(error instanceof SyntaxError ? 'Tệp JSON bị lỗi định dạng.' : error instanceof Error ? error.message : 'Không thể đọc tệp.')
    }
  }

  return <Modal open={section !== null} close={close} label="Cài đặt NoteScape" className="settings-modal">
    <div className="settings-inner">
      <div className="settings-header"><div><h1>Cài đặt</h1></div><IconButton label="Đóng cài đặt" onClick={close}><X size={20} /></IconButton></div>
      <nav className="settings-tabs" aria-label="Danh mục cài đặt">
        {sections.map(([id, title, Icon]) => <button type="button" key={id} aria-pressed={section === id} onClick={() => select(id)}><Icon size={16} />{title}</button>)}
      </nav>
      <div className="settings-body">
        <h2>{sections.find(([id]) => id === section)?.[1]}</h2>
        {section === 'appearance' && <div className="section-stack">
          <RangeField label="Lớp phủ tối" value={settings.overlay} min={0} max={75} unit="%" onChange={(overlay) => update({ overlay })} />
          <RangeField label="Độ mờ hình nền" value={settings.blur} min={0} max={16} unit=" px" onChange={(blur) => update({ blur })} />
          <label className="toggle-field">Hiệu ứng chuyển hình nền<input type="checkbox" role="switch" checked={settings.animate} onChange={(event) => update({ animate: event.target.checked })} /></label>
          <label className="toggle-field">Màu ghi chú mặc định<input type="color" value={settings.defaultColor} onChange={(event) => update({ defaultColor: event.target.value })} /></label>
          <RangeField label="Độ đậm nền ghi chú" value={settings.defaultOpacity} min={0} max={100} unit="%" onChange={(defaultOpacity) => update({ defaultOpacity })} />
        </div>}
        {section === 'notes' && <div className="section-stack">
          <RangeField label="Chiều rộng mặc định" value={settings.width} min={MIN_WIDTH} max={MAX_WIDTH} unit=" px" onChange={(width) => update({ width })} />
          <RangeField label="Chiều cao mặc định" value={settings.height} min={MIN_HEIGHT} max={MAX_HEIGHT} unit=" px" onChange={(height) => update({ height })} />
          <RangeField label="Cỡ chữ mặc định" value={settings.fontSize} min={12} max={28} unit=" px" onChange={(fontSize) => update({ fontSize })} />
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => exportBackup({ notes, settings, shortcuts })}><Download size={17} /> Xuất JSON</button>
            <button type="button" className="secondary-button" onClick={() => file.current?.click()}><Upload size={17} /> Nhập JSON</button>
            <input type="file" ref={file} accept=".json,application/json" hidden onChange={(event) => { void readBackup(event.currentTarget) }} />
          </div>
          {fileError && <p role="alert" className="form-error">{fileError}</p>}
        </div>}
        {section === 'weather' && <CityForm city={settings.city} select={(city) => update({ city })} />}
        {section === 'shortcuts' && <ShortcutForm shortcuts={shortcuts} save={board.setShortcuts} />}
        {section === 'general' && <div className="section-stack">
          <p className="form-hint">Cài NoteScape trên cả hai máy, dùng cùng hệ trình duyệt và cùng tài khoản, rồi bật đồng bộ dữ liệu tiện ích. Chrome và Edge có hệ đồng bộ riêng.</p>
          <p className="form-hint">Trạng thái lưu chỉ phản ánh dữ liệu trên trình duyệt hiện tại. Trình duyệt sẽ chuyển thay đổi đến các thiết bị theo lịch đồng bộ của nó.</p>
          {state.conflicts.length > 0 && <button type="button" className="secondary-button" onClick={showConflicts}>Xem thay đổi cần xử lý</button>}
          <button type="button" className="secondary-button" onClick={() => confirm({
            title: 'Khôi phục cài đặt?',
            text: 'Giao diện và thành phố thời tiết sẽ trở về mặc định. Ghi chú và lối tắt của bạn được giữ lại.',
            action: 'Khôi phục', run: () => update(defaults),
          })}>Khôi phục cài đặt mặc định</button>
          <p className="settings-version">NoteScape {chrome.runtime.getManifest().version}</p>
        </div>}
      </div>
    </div>
  </Modal>
}
