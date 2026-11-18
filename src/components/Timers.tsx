import { FastForward, Hourglass, Pause, Play, RotateCcw, Timer } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { defaultCountdownPosition, defaultPomodoroPosition, widgetVisible } from '../model'
import type { Settings, WidgetId } from '../model'
import {
  countdownEvents, defaultPomodoro, MAX_COUNTDOWNS, MAX_TIMER_TIMESTAMP, nextPomodoro, pomodoroRemaining,
  resetPomodoro, saveCountdown, timerParts, togglePomodoro,
} from '../timers'
import { IconButton, RangeField } from './Controls'
import type { SnapGuides } from '../snap'
import { EditableWidget } from './EditableWidget'

const eventDate = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' })

export function TimerWidgets({ settings, update, configure, editing, setVisibility, showGuides }: {
  settings: Settings; update: (patch: Partial<Settings>) => void; configure: () => void; editing: boolean
  setVisibility: (widget: WidgetId, visible: boolean) => void
  showGuides: (guides: SnapGuides) => void
}) {
  const [now, setNow] = useState(Date.now)
  const timer = settings.pomodoro ?? defaultPomodoro
  const countdowns = countdownEvents(settings).slice().sort((a, b) => a.endsAt - b.endsAt)
  const showCountdown = widgetVisible(settings, 'countdown')
  const showPomodoro = widgetVisible(settings, 'pomodoro')
  const until = Math.max(showCountdown ? countdowns.at(-1)?.endsAt ?? 0 : 0, showPomodoro ? timer.endsAt ?? 0 : 0)
  useEffect(() => {
    let tickId: ReturnType<typeof setTimeout>
    function tick() {
      clearTimeout(tickId)
      const current = Date.now()
      setNow(current)
      if (current < until) tickId = setTimeout(tick, Math.min(until - current, 1000 - current % 1000))
    }
    tick()
    document.addEventListener('visibilitychange', tick)
    return () => {
      document.removeEventListener('visibilitychange', tick)
      clearTimeout(tickId)
    }
  }, [until])

  const remaining = pomodoroRemaining(timer, now)
  const running = timer.endsAt !== null && remaining > 0
  const finished = timer.endsAt !== null && remaining === 0
  const pomodoroTime = timerParts(remaining).time.replace(/^00:/, '')
  const nextLabel = timer.phase === 'focus' ? 'Bắt đầu nghỉ' : 'Bắt đầu tập trung'
  const countdownPosition = { ...defaultCountdownPosition, ...settings.countdownPosition }
  const pomodoroPosition = { ...defaultPomodoroPosition, ...settings.pomodoroPosition }
  return <aside className="widgets timer-widgets" aria-label="Tiện ích hẹn giờ">
    {showCountdown && <EditableWidget label="Countdown" appearance={countdownPosition} editing={editing} showGuides={showGuides}
      hide={() => setVisibility('countdown', false)}
      update={({ x = countdownPosition.x, y = countdownPosition.y, scale = countdownPosition.scale }) => update({ countdownPosition: { x, y, scale } })}>
      <section className="timer-card glass" aria-label="Countdown">
        <div className="timer-heading"><Hourglass size={15} /> <h2>Countdown</h2></div>
        {countdowns.length > 0 && <ul className="countdown-events">
          {countdowns.map((event) => {
            const parts = timerParts(event.endsAt - now)
            const title = event.title || 'Mốc thời gian'
            return <li key={event.id}>
              <h3>{title}</h3>
              <div className="timer-value" role="timer" aria-label={title}>
                {parts.days > 0 && <small>{parts.days} ngày </small>}{parts.time}
              </div>
              <div className="countdown-date">{event.endsAt <= now ? 'Đã đến mốc' : eventDate.format(event.endsAt)}</div>
            </li>
          })}
        </ul>}
        <div className="timer-actions">
          <button type="button" className="timer-link" onClick={configure}>{countdowns.length ? 'Quản lý mốc' : 'Đặt mốc'}</button>
        </div>
      </section>
    </EditableWidget>}
    {showPomodoro && <EditableWidget label="Pomodoro" appearance={pomodoroPosition} editing={editing} showGuides={showGuides}
      hide={() => setVisibility('pomodoro', false)}
      update={({ x = pomodoroPosition.x, y = pomodoroPosition.y, scale = pomodoroPosition.scale }) => update({ pomodoroPosition: { x, y, scale } })}>
      <section className="timer-card glass" aria-label="Pomodoro">
        <div className="timer-heading"><Timer size={15} /> <h2>Pomodoro</h2><span>{timer.phase === 'focus' ? 'Tập trung' : 'Nghỉ'}</span></div>
        <div className="timer-value" role="timer">{pomodoroTime}</div>
        <div className="timer-actions">
          <button type="button" className="timer-primary" onClick={() => {
            const current = Date.now()
            setNow(current)
            update({ pomodoro: togglePomodoro(timer, current) })
          }}>
            {running ? <Pause size={14} /> : <Play size={14} />}
            {running ? 'Tạm dừng' : finished ? nextLabel : timer.pausedMs !== null ? 'Tiếp tục' : 'Bắt đầu'}
          </button>
          <IconButton label="Chuyển phiên Pomodoro" onClick={() => update({ pomodoro: nextPomodoro(timer) })}><FastForward size={15} /></IconButton>
          <IconButton label="Đặt lại Pomodoro" onClick={() => update({ pomodoro: resetPomodoro(timer) })}><RotateCcw size={15} /></IconButton>
        </div>
      </section>
    </EditableWidget>}
  </aside>
}

function localDateTime(ending?: number) {
  if (ending === undefined) return ''
  const date = new Date(ending)
  return new Date(ending - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function CountdownSettings({ settings, update, startAdding }: {
  settings: Settings; update: (patch: Partial<Settings>) => void; startAdding: boolean
}) {
  const events = countdownEvents(settings)
  const [editing, setEditing] = useState<{ id?: string } | undefined>(() => startAdding && !events.length ? {} : undefined)
  const [error, setError] = useState('')
  const event = editing?.id ? events.find((item) => item.id === editing.id) : undefined

  function edit(id?: string) {
    setEditing({ id })
    setError('')
  }

  function save(submit: FormEvent<HTMLFormElement>) {
    submit.preventDefault()
    if (!editing) return
    const inputs = new FormData(submit.currentTarget)
    const endsAt = new Date(String(inputs.get('endsAt'))).getTime()
    if (!Number.isFinite(endsAt) || endsAt <= 0 || endsAt > MAX_TIMER_TIMESTAMP) {
      setError('Chọn ngày và giờ hợp lệ.')
      return
    }
    const next = saveCountdown(events, {
      id: editing.id ?? crypto.randomUUID(), title: String(inputs.get('title') ?? '').trim(), endsAt,
    }, editing.id === undefined)
    if (!next) {
      setError(editing.id ? 'Mốc này đã được xóa.' : 'Chỉ lưu được tối đa 3 mốc thời gian.')
      return
    }
    update({ countdowns: next })
    setEditing(undefined)
    setError('')
  }

  return <>
    {events.length > 0 && <ul className="countdown-settings-list">
      {events.map((item) => {
        const title = item.title || 'Mốc thời gian'
        return <li key={item.id}>
          <div><strong>{title}</strong><small>{eventDate.format(item.endsAt)}</small></div>
          <button type="button" className="secondary-button" aria-label={`Sửa ${title}`} onClick={() => edit(item.id)}>Sửa</button>
          <button type="button" className="secondary-button" aria-label={`Xóa ${title}`} onClick={() => {
            update({ countdowns: events.filter((other) => other.id !== item.id) })
            if (editing?.id === item.id) setEditing(undefined)
          }}>Xóa</button>
        </li>
      })}
    </ul>}
    {editing ? <form className="field-stack" key={editing.id ?? ''} onSubmit={save}>
      <label>Tên sự kiện<input name="title" defaultValue={event?.title} maxLength={60} /></label>
      <label>Ngày và giờ kết thúc<input name="endsAt" type="datetime-local" required defaultValue={localDateTime(event?.endsAt)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="button-row">
        <button type="submit" className="primary-button">Lưu mốc</button>
        <button type="button" className="secondary-button" onClick={() => setEditing(undefined)}>Hủy</button>
      </div>
    </form> : <div className="countdown-settings-actions">
      <button type="button" className="secondary-button" disabled={events.length >= MAX_COUNTDOWNS} onClick={() => edit()}>Thêm mốc</button>
      <span>{events.length}/{MAX_COUNTDOWNS} mốc</span>
    </div>}
  </>
}

export function PomodoroSettings({ settings, update }: {
  settings: Settings; update: (patch: Partial<Settings>) => void
}) {
  const timer = settings.pomodoro ?? defaultPomodoro
  return <>
    <RangeField label="Thời gian tập trung" value={timer.focusMinutes} min={1} max={120} unit=" phút"
      onChange={(focusMinutes) => update({ pomodoro: { ...timer, focusMinutes } })} />
    <RangeField label="Thời gian nghỉ" value={timer.breakMinutes} min={1} max={60} unit=" phút"
      onChange={(breakMinutes) => update({ pomodoro: { ...timer, breakMinutes } })} />
  </>
}
