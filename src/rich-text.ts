import type { JSONContent } from '@tiptap/core'

const children: Record<string, string[]> = {
  doc: ['paragraph', 'bulletList', 'orderedList', 'taskList'],
  paragraph: ['text', 'hardBreak'],
  bulletList: ['listItem'],
  orderedList: ['listItem'],
  taskList: ['taskItem'],
  listItem: ['paragraph', 'bulletList', 'orderedList', 'taskList'],
  taskItem: ['paragraph', 'bulletList', 'orderedList', 'taskList'],
  text: [],
  hardBreak: [],
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const marks = new Set(['bold', 'italic'])
const isListStyle = (value: unknown) => typeof value === 'string' && /^[1AaIi]$/.test(value)
const isListStart = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value)

function isNode(value: unknown, allowed: string[], depth: number): value is JSONContent {
  if (!isObject(value) || typeof value.type !== 'string' || !allowed.includes(value.type) || depth > 256) return false
  const childTypes = children[value.type]!
  if (value.marks !== undefined &&
    (!Array.isArray(value.marks) || !value.marks.every((mark: unknown) =>
      isObject(mark) && typeof mark.type === 'string' && marks.has(mark.type)))) return false
  if (value.type === 'text') return typeof value.text === 'string' && value.text.length > 0 && value.content === undefined
  if (value.type === 'hardBreak') return value.content === undefined

  if (value.type === 'taskItem' && (!isObject(value.attrs) || typeof value.attrs.checked !== 'boolean')) return false
  if (value.type === 'orderedList' && value.attrs !== undefined) {
    if (!isObject(value.attrs) || !isListStart(value.attrs.start)
      || (value.attrs.type != null && !isListStyle(value.attrs.type))) return false
  }
  if (value.type === 'paragraph' && value.content === undefined) return true
  if (!Array.isArray(value.content) || !value.content.length) return false
  if ((value.type === 'taskItem' || value.type === 'listItem') && value.content[0]?.type !== 'paragraph') return false
  return value.content.every((node: unknown) => isNode(node, childTypes, depth + 1))
}

export function serializeRichText(doc: JSONContent) {
  return JSON.stringify(doc, (_, value: unknown) => {
    if (!isObject(value) || value.type !== 'orderedList') return value
    // Pasted HTML can supply arbitrary list attributes, even when the editor schema is restricted.
    const attrs = isObject(value.attrs) ? value.attrs : {}
    return { ...value, attrs: { start: isListStart(attrs.start) ? attrs.start : 1, type: isListStyle(attrs.type) ? attrs.type : null } }
  })
}

export function parseRichText(content: string): JSONContent | undefined {
  try {
    const doc: unknown = JSON.parse(content)
    if (isNode(doc, ['doc'], 0)) return doc
  } catch {
    // A malformed document is rejected by storage and backup validation.
  }
}

export function richTextFromPlain(content: string): JSONContent {
  return {
    type: 'doc',
    content: content.split(/\r\n?|\n/).map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : undefined,
    })),
  }
}
