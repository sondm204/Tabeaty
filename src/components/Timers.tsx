import { FastForward, Hourglass, Pause, Play, RotateCcw, Timer } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Settings } from '../model'
import { defaultPomodoro, nextPomodoro, pomodoroRemaining, resetPomodoro, timerParts, togglePomodoro } from '../timers'
import { IconButton, RangeField } from './Controls'

export function TimerWidgets({ settings, update, configure }: {
  settings: Settings; update: (patch: Partial<Settings>) => void; configure: () => void
}) {
  const [now, setNow] = useState(Date.now)
  const timer = settings.pomodoro ?? defaultPomodoro
  const countdown = settings.countdown
  const until = Math.max(countdown?.endsAt ?? 0, timer.endsAt ?? 0)
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
  const countdownParts = countdown ? timerParts(countdown.endsAt - now) : undefined
  const pomodoroTime = timerParts(remaining).time.replace(/^00:/, '')
  const nextLabel = timer.phase === 'focus' ? 'Bắt đầu nghỉ' : 'Bắt đầu tập trung'
  return <aside className="timer-widgets" aria-label="Tiện ích hẹn giờ">
    <section className="timer-card glass" aria-label="Countdown">
      <div className="timer-heading"><Hourglass size={15} /> <h2>{countdown?.title || 'Countdown'}</h2></div>
      {countdownParts && <div className="timer-value" role="timer">
        {countdownParts.days > 0 && <small>{countdownParts.days} ngày </small>}{countdownParts.time}
      </div>}
      <div className="timer-actions">
        {countdown && <span>{countdown.endsAt <= now ? 'Đã đến mốc' : new Date(countdown.endsAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</span>}
        <button type="button" className="timer-link" onClick={configure}>{countdown ? 'Đổi mốc' : 'Đặt mốc'}</button>
      </div>
    </section>
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
  </aside>
}

function localDateTime(ending?: number) {
  if (ending === undefined) return ''
  const date = new Date(ending)
  return new Date(ending - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function TimerSettings({ settings, update }: {
  settings: Settings; update: (patch: Partial<Settings>) => void
}) {
  const timer = settings.pomodoro ?? defaultPomodoro
  const countdown = settings.countdown
  const [error, setError] = useState('')

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const inputs = new FormData(event.currentTarget)
    const endsAt = new Date(String(inputs.get('endsAt'))).getTime()
    if (!Number.isFinite(endsAt) || endsAt <= 0 || endsAt > 253402300799999) {
      setError('Chọn ngày và giờ hợp lệ.')
      return
    }
    setError('')
    update({ countdown: { title: String(inputs.get('title') ?? '').trim(), endsAt }, showTimers: true })
  }

  return <div className="section-stack">
    <label className="toggle-field">Hiện tiện ích hẹn giờ
      <input type="checkbox" role="switch" checked={settings.showTimers ?? false}
        onChange={(event) => update({ showTimers: event.target.checked })} />
    </label>
    <fieldset className="widget-settings">
      <legend>Countdown</legend>
      <form className="field-stack" key={JSON.stringify(countdown ?? null)} onSubmit={save}>
        <label>Tên sự kiện<input name="title" defaultValue={countdown?.title} maxLength={60} /></label>
        <label>Ngày và giờ kết thúc<input name="endsAt" type="datetime-local" required defaultValue={localDateTime(countdown?.endsAt)} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="button-row">
          <button type="submit" className="primary-button">Lưu mốc</button>
          {countdown && <button type="button" className="secondary-button" onClick={() => {
            setError('')
            update({ countdown: null })
          }}>Xóa mốc</button>}
        </div>
      </form>
    </fieldset>
    <fieldset className="widget-settings">
      <legend>Pomodoro</legend>
      <RangeField label="Thời gian tập trung" value={timer.focusMinutes} min={1} max={120} unit=" phút"
        onChange={(focusMinutes) => update({ pomodoro: { ...timer, focusMinutes } })} />
      <RangeField label="Thời gian nghỉ" value={timer.breakMinutes} min={1} max={60} unit=" phút"
        onChange={(breakMinutes) => update({ pomodoro: { ...timer, breakMinutes } })} />
    </fieldset>
  </div>
}
