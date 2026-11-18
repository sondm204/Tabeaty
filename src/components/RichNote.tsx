import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TaskItem } from '@tiptap/extension-task-item'
import { TaskList } from '@tiptap/extension-task-list'
import { Bold, Italic, List, ListChecks, ListOrdered } from 'lucide-react'
import { useEffect } from 'react'
import { parseRichText, richTextFromPlain, serializeRichText } from '../rich-text'
import { IconButton } from './Controls'

const extensions = [
  StarterKit.configure({
    blockquote: false, code: false, codeBlock: false, heading: false, horizontalRule: false,
    link: false, strike: false, underline: false,
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
]

export default function RichNote({ value, fontSize, autofocus, onChange }: {
  value: string; fontSize: number; autofocus: boolean; onChange: (value: string) => void
}) {
  const editor = useEditor({
    extensions,
    content: parseRichText(value) ?? richTextFromPlain(value),
    autofocus,
    editorProps: { attributes: { 'aria-label': 'Nội dung ghi chú định dạng', role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor }) => onChange(serializeRichText(editor.getJSON())),
  })
  const marks = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive('bold'), italic: editor?.isActive('italic'), bullets: editor?.isActive('bulletList'),
      ordered: editor?.isActive('orderedList'), tasks: editor?.isActive('taskList'),
    }),
  })

  useEffect(() => {
    if (editor && value !== serializeRichText(editor.getJSON())) {
      editor.commands.setContent(parseRichText(value) ?? richTextFromPlain(value), { emitUpdate: false })
    }
  }, [editor, value])

  if (!editor) return null
  return <>
    <div className="rich-toolbar" role="group" aria-label="Định dạng ghi chú" onMouseDown={(event) => event.preventDefault()}>
      <IconButton label="In đậm" aria-pressed={marks?.bold} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={14} /></IconButton>
      <IconButton label="In nghiêng" aria-pressed={marks?.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={14} /></IconButton>
      <IconButton label="Danh sách gạch đầu dòng" aria-pressed={marks?.bullets} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></IconButton>
      <IconButton label="Danh sách đánh số" aria-pressed={marks?.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></IconButton>
      <IconButton label="Danh sách việc cần làm" aria-pressed={marks?.tasks} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListChecks size={15} /></IconButton>
    </div>
    <EditorContent editor={editor} className="rich-content" style={{ fontSize }} />
  </>
}
