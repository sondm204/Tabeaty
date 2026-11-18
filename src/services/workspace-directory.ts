import { useCallback, useEffect, useRef, useState } from 'react'
import { firstWorkspace, normalizeWorkspaceName, readWorkspaceNames, workspaceNameKey, workspaceNameKeys, workspaceSlots } from '../workspaces'
import type { WorkspaceSlot } from '../workspaces'

export class WorkspaceNameError extends Error {}

export function useWorkspaceDirectory() {
  const [workspaces, setWorkspaces] = useState([firstWorkspace])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const sequence = useRef(0)

  const refresh = useCallback(async () => {
    const request = ++sequence.current
    try {
      const values = await chrome.storage.sync.get(workspaceNameKeys)
      if (sequence.current !== request) return
      setWorkspaces(readWorkspaceNames(values))
      setReady(true)
      setError('')
    } catch {
      if (sequence.current === request) setError('Không thể đọc danh sách workspace.')
    }
  }, [])

  useEffect(() => {
    const changed = (changes: Record<string, unknown>, area: string) => {
      if (area === 'sync' && workspaceNameKeys.some((key) => Object.hasOwn(changes, key))) void refresh()
    }
    chrome.storage.onChanged.addListener(changed)
    void refresh()
    return () => {
      sequence.current++
      chrome.storage.onChanged.removeListener(changed)
    }
  }, [refresh])

  async function save(name: string, renameSlot?: WorkspaceSlot) {
    const normalized = normalizeWorkspaceName(name)
    if (!normalized) throw new WorkspaceNameError('Nhập tên workspace từ 1 đến 32 ký tự.')
    const persist = async () => {
      const current = readWorkspaceNames(await chrome.storage.sync.get(workspaceNameKeys))
      const slot = renameSlot ?? workspaceSlots.find((candidate) => !current.some((item) => item.slot === candidate))
      if (!slot) throw new WorkspaceNameError('Bạn đã có tối đa 3 workspace.')
      if (renameSlot && !current.some((item) => item.slot === renameSlot)) throw new WorkspaceNameError('Workspace này không còn khả dụng.')
      await chrome.storage.sync.set({ [workspaceNameKey(slot)]: normalized })
      await refresh()
      return { slot, name: normalized }
    }
    return navigator.locks ? navigator.locks.request('notescape.workspace-directory', persist) : persist()
  }

  return { workspaces, ready, error, refresh, save }
}

export type WorkspaceDirectory = ReturnType<typeof useWorkspaceDirectory>
