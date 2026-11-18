import { Check, ChevronDown, Layers, Pencil, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { WorkspaceNameError } from '../services/workspace-directory'
import type { WorkspaceDirectory } from '../services/workspace-directory'
import { workspaceSlots } from '../workspaces'
import type { Workspace, WorkspaceSlot } from '../workspaces'

export function WorkspacePicker({ active, directory, select }: {
  active: Workspace
  directory: WorkspaceDirectory
  select: (slot: WorkspaceSlot) => void
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'create' | 'rename' | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const { workspaces, ready } = directory

  function close() {
    setOpen(false)
    setMode(null)
    setError('')
  }

  useEffect(() => {
    if (!open || saving) return
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) close()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation()
        close()
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [open, saving])

  function edit(next: 'create' | 'rename') {
    setMode(next)
    setName(next === 'rename' ? active.name : '')
    setError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const workspace = await directory.save(name, mode === 'rename' ? active.slot : undefined)
      close()
      trigger.current?.focus()
      if (mode === 'create') select(workspace.slot)
    } catch (problem) {
      const message = problem instanceof WorkspaceNameError
        ? problem.message : 'Không thể lưu workspace. Hãy thử lại.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return <div className="workspace-picker" ref={root}>
    <button type="button" className="workspace-trigger glass" ref={trigger} aria-label={`Chọn workspace: ${active.name}`}
      title={active.name} aria-expanded={open} disabled={saving} onClick={() => open ? close() : setOpen(true)}>
      <Layers size={16} /><span>{active.name}</span><ChevronDown size={13} />
    </button>
    {open && <div className="workspace-menu" aria-label="Workspace">
      <div className="workspace-menu-heading">Workspace <span>{workspaces.length}/{workspaceSlots.length}</span></div>
      {workspaces.map((workspace) => <button type="button" key={workspace.slot} aria-current={workspace.slot === active.slot ? 'true' : undefined}
        disabled={saving} className="workspace-row" onClick={() => { close(); trigger.current?.focus(); select(workspace.slot) }}>
        <span>{workspace.name}</span>{workspace.slot === active.slot && <Check size={16} />}
      </button>)}
      {directory.error && <div className="workspace-error" role="alert">{directory.error} <button type="button" onClick={() => { void directory.refresh() }}>Thử lại</button></div>}
      {mode ? <form className="workspace-form" onSubmit={(event) => { void submit(event) }}>
        <label>{mode === 'create' ? 'Tên workspace mới' : 'Tên workspace'}
          <input value={name} autoFocus maxLength={32} required disabled={saving} onChange={(event) => setName(event.target.value)} />
        </label>
        {error && <p className="workspace-error" role="alert">{error}</p>}
        <div className="button-row">
          <button type="submit" className="primary-button" disabled={saving}>{mode === 'create' ? 'Tạo workspace' : 'Lưu tên'}</button>
          <button type="button" className="secondary-button" disabled={saving} onClick={() => { setMode(null); setError('') }}>Hủy</button>
        </div>
      </form> : <div className="workspace-menu-actions">
        <button type="button" className="workspace-row" disabled={!ready || workspaces.length >= workspaceSlots.length}
          onClick={() => edit('create')}><Plus size={16} /> Thêm workspace</button>
        <button type="button" className="workspace-row" disabled={!ready} onClick={() => edit('rename')}><Pencil size={15} /> Đổi tên workspace</button>
      </div>}
    </div>}
  </div>
}
