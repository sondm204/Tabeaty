export const workspaceSlots = ['1', '2', '3'] as const
export type WorkspaceSlot = typeof workspaceSlots[number]
export interface Workspace { slot: WorkspaceSlot; name: string }

export const firstWorkspace: Workspace = { slot: '1', name: 'Workspace 1' }
export const workspaceNameKey = (slot: WorkspaceSlot) => `notescape.workspace.${slot}`
export const workspaceNameKeys = workspaceSlots.map(workspaceNameKey)
const selectionKey = 'notescape.activeWorkspace'

export function normalizeWorkspaceName(value: unknown) {
  if (typeof value !== 'string') return undefined
  const name = value.trim()
  return name && name.length <= 32 ? name : undefined
}

export function readWorkspaceNames(values: Record<string, unknown>): Workspace[] {
  return workspaceSlots.flatMap((slot) => {
    const name = normalizeWorkspaceName(values[workspaceNameKey(slot)])
    return name ? [{ slot, name }] : slot === '1' ? [firstWorkspace] : []
  })
}

export function readWorkspaceSelection(): WorkspaceSlot {
  try {
    const slot = localStorage.getItem(selectionKey)
    if (slot === '2' || slot === '3') return slot
  } catch { /* Switching still works if the local preference cannot be read. */ }
  return '1'
}

export function rememberWorkspace(slot: WorkspaceSlot) {
  try { localStorage.setItem(selectionKey, slot) } catch { /* The choice remains active in this tab. */ }
}
