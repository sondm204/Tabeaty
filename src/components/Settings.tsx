import { ArrowDown, ArrowUp, ChevronDown, Download, Globe2, LayoutGrid, MapPin, Move, Plus, Search, SlidersHorizontal, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode, Ref } from 'react'
import {
  defaultClockAppearance, defaultWeatherAppearance, defaults, MAX_HEIGHT, MAX_SHORTCUTS,
  MAX_WIDTH, MIN_HEIGHT, MIN_WIDTH, widgetVisible,
} from '../model'
import type { City, ClockDisplay, Shortcut, WidgetId } from '../model'
import { parseBackup, serializeBackup } from '../services/backup'
import type { Backup } from '../services/backup'
import type { Board } from '../services/board'
import { normalizeUrl } from '../services/validation'
import { searchCities } from '../services/weather'
import { IconButton, RangeField } from './Controls'
import { CountdownSettings, PomodoroSettings } from './Timers'

const sections = [
  ['appearance', 'Giao diện', SlidersHorizontal], ['widgets', 'Tiện ích', LayoutGrid], ['general', 'Đồng bộ', Globe2],
] as const
export type SettingsSection = (typeof sections)[number][0]
export type WidgetTarget = 'weather' | 'countdown' | 'shortcuts'
export interface Confirmation { title: string; text: string; action: string; run: () => void; destructive?: boolean; alternate?: { label: string; run: () => void } }

export function Modal({ open, close, children, label, className }: {
  open: boolean; close: () => void; children: ReactNode; label: string; className: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const lastChildren = useRef<ReactNode>(null)
  const [retainExit, setRetainExit] = useState(false)
  useLayoutEffect(() => {
    if (open) lastChildren.current = children
  }, [open, children])
  useLayoutEffect(() => {
    const node = dialog.current
    if (!node) return
    if (open) {
      if (!node.open) node.showModal()
      setRetainExit(true)
    } else if (node.open) node.close()
  }, [open])
  useEffect(() => {
    if (open || !retainExit) return
    const release = setTimeout(() => {
      lastChildren.current = null
      setRetainExit(false)
    }, 220)
    return () => clearTimeout(release)
  }, [open, retainExit])
  return <dialog ref={dialog} className={className} aria-label={label}
    onCancel={(event) => { event.preventDefault(); close() }}
    onClick={(event) => { if (event.target === event.currentTarget) close() }}>
    {open ? children : retainExit ? lastChildren.current : null}
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

function ColorField({ label, value, onChange }: {
  label: string; value: string; onChange: (value: string) => void
}) {
  return <label className="toggle-field">{label}
    <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
  </label>
}

function WidgetGroup({ title, target, toggle, children }: {
  title: string; target?: Ref<HTMLElement>; toggle?: ReactNode; children: ReactNode
}) {
  const [expanded, setExpanded] = useState(!!target)
  const contentId = useId()
  useLayoutEffect(() => { if (target) setExpanded(true) }, [target])
  return <section className="widget-settings" data-expanded={expanded} ref={target}>
    <div className="widget-settings-header">
      <button type="button" className="widget-settings-toggle" aria-expanded={expanded} aria-controls={contentId}
        onClick={() => setExpanded((previous) => !previous)}>{title}<ChevronDown aria-hidden="true" size={16} /></button>
      {toggle}
    </div>
    <div id={contentId} className="widget-settings-collapse" inert={!expanded} aria-hidden={!expanded}>
      <div className="widget-settings-clip"><div className="widget-settings-content">{children}</div></div>
    </div>
  </section>
}

export function SettingsPanel({ section, close, select, board, state, confirm, showConflicts, editWidgetLayout, widgetTarget }: {
  section: SettingsSection | null
  close: () => void
  select: (section: SettingsSection) => void
  board: Board
  state: ReturnType<Board['snapshot']>
  confirm: (value: Confirmation) => void
  showConflicts: () => void
  editWidgetLayout: () => void
  widgetTarget: WidgetTarget | null
}) {
  const { settings, shortcuts, notes } = state
  const [fileError, setFileError] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const target = useRef<HTMLElement>(null)
  const update = board.updateSettings
  const clock = settings.clockAppearance ?? defaultClockAppearance
  const weather = settings.weatherAppearance ?? defaultWeatherAppearance
  useEffect(() => {
    if (section === 'widgets' && widgetTarget) target.current?.scrollIntoView({ block: 'start' })
  }, [section, widgetTarget])

  function visibility(widget: WidgetId, label: string) {
    return <input className="widget-visibility" type="checkbox" aria-label={`Hiện ${label}`} title={`Hiện ${label}`}
      checked={widgetVisible(settings, widget)} onChange={(event) => board.setWidgetVisibility(widget, event.target.checked)} />
  }

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
      <div className="settings-body" key={section}>
        <h2>{sections.find(([id]) => id === section)?.[1]}</h2>
        {section === 'appearance' && <div className="section-stack">
          <RangeField label="Lớp phủ tối" value={settings.overlay} min={0} max={75} unit="%" onChange={(overlay) => update({ overlay })} />
          <RangeField label="Độ mờ hình nền" value={settings.blur} min={0} max={16} unit=" px" onChange={(blur) => update({ blur })} />
          <label className="toggle-field">Hiệu ứng chuyển hình nền<input type="checkbox" role="switch" checked={settings.animate} onChange={(event) => update({ animate: event.target.checked })} /></label>
        </div>}
        {section === 'widgets' && <div className="section-stack">
          <button className="secondary-button" type="button" onClick={editWidgetLayout}><Move size={16} /> Kéo thả tiện ích trên bảng</button>
          <WidgetGroup title="Ngày giờ" toggle={visibility('clock', 'ngày giờ')}>
            <label className="toggle-field">Hiển thị ngày giờ
              <select value={settings.clockDisplay ?? 'date-time'} onChange={(event) => update({ clockDisplay: event.target.value as ClockDisplay })}>
                <option value="date-time">Ngày và giờ</option>
                <option value="time">Chỉ giờ</option>
                <option value="date">Chỉ ngày</option>
              </select>
            </label>
            <ColorField label="Màu chữ" value={clock.color} onChange={(color) => update({ clockAppearance: { ...clock, color } })} />
          </WidgetGroup>
          <WidgetGroup title="Thời tiết" target={widgetTarget === 'weather' ? target : undefined} toggle={visibility('weather', 'thời tiết')}>
            <CityForm city={settings.city} select={(city) => update({ city })} />
            <ColorField label="Màu chữ" value={weather.color} onChange={(color) => update({ weatherAppearance: { ...weather, color } })} />
            <ColorField label="Màu nền" value={weather.backgroundColor}
              onChange={(backgroundColor) => update({ weatherAppearance: { ...weather, backgroundColor } })} />
            <RangeField label="Độ đậm nền" value={weather.opacity} min={0} max={100} unit="%"
              onChange={(opacity) => update({ weatherAppearance: { ...weather, opacity } })} />
          </WidgetGroup>
          <WidgetGroup title="Countdown" target={widgetTarget === 'countdown' ? target : undefined} toggle={visibility('countdown', 'Countdown')}>
            <CountdownSettings settings={settings} update={update} startAdding={widgetTarget === 'countdown'} />
          </WidgetGroup>
          <WidgetGroup title="Pomodoro" toggle={visibility('pomodoro', 'Pomodoro')}>
            <PomodoroSettings settings={settings} update={update} />
          </WidgetGroup>
          <WidgetGroup title="Ghi chú" toggle={visibility('notes', 'ghi chú')}>
            <p className="form-hint">Giữ Shift khi kéo ghi chú hoặc kéo cạnh để căn theo ghi chú khác hay tâm màn hình.</p>
            <ColorField label="Màu ghi chú mặc định" value={settings.defaultColor} onChange={(defaultColor) => update({ defaultColor })} />
            <RangeField label="Độ đậm nền ghi chú" value={settings.defaultOpacity} min={0} max={100} unit="%" onChange={(defaultOpacity) => update({ defaultOpacity })} />
            <RangeField label="Chiều rộng ghi chú mới" value={settings.width} min={MIN_WIDTH} max={MAX_WIDTH} unit=" px" onChange={(width) => update({ width })} />
            <RangeField label="Chiều cao ghi chú mới" value={settings.height} min={MIN_HEIGHT} max={MAX_HEIGHT} unit=" px" onChange={(height) => update({ height })} />
            <RangeField label="Cỡ chữ mặc định" value={settings.fontSize} min={12} max={28} unit=" px" onChange={(fontSize) => update({ fontSize })} />
            <div className="button-row">
              <button type="button" className="secondary-button" onClick={() => exportBackup({ notes, settings, shortcuts })}><Download size={17} /> Xuất JSON</button>
              <button type="button" className="secondary-button" onClick={() => file.current?.click()}><Upload size={17} /> Nhập JSON</button>
              <input type="file" ref={file} accept=".json,application/json" hidden onChange={(event) => { void readBackup(event.currentTarget) }} />
            </div>
            {fileError && <p role="alert" className="form-error">{fileError}</p>}
          </WidgetGroup>
          <WidgetGroup title="Lối tắt" target={widgetTarget === 'shortcuts' ? target : undefined} toggle={visibility('shortcuts', 'lối tắt')}>
            <ShortcutForm shortcuts={shortcuts} save={board.setShortcuts} />
          </WidgetGroup>
        </div>}
        {section === 'general' && <div className="section-stack">
          <p className="form-hint">Cài NoteScape trên cả hai máy, dùng cùng hệ trình duyệt và cùng tài khoản, rồi bật đồng bộ dữ liệu tiện ích. Chrome và Edge có hệ đồng bộ riêng.</p>
          <p className="form-hint">Trình duyệt sẽ chuyển thay đổi đến các thiết bị theo lịch đồng bộ của nó.</p>
          {state.conflicts.length > 0 && <button type="button" className="secondary-button" onClick={showConflicts}>Xem thay đổi cần xử lý</button>}
          <button type="button" className="secondary-button" onClick={() => confirm({
            title: 'Khôi phục cài đặt?',
            text: 'Giao diện và tiện ích của workspace sẽ trở về mặc định. Các mốc Countdown sẽ bị xóa.',
            action: 'Khôi phục', run: () => update(defaults),
          })}>Khôi phục cài đặt mặc định</button>
          <p className="settings-version">NoteScape {chrome.runtime.getManifest().version}</p>
        </div>}
      </div>
    </div>
  </Modal>
}
