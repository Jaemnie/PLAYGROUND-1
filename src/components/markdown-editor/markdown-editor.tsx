'use client'

import { useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { cn } from '@/lib/utils'
import { Toolbar } from './toolbar'
import { MarkdownPreview } from './markdown-preview'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff } from 'lucide-react'

interface MarkdownEditorProps {
  content: string
  onChange: (content: string) => void
  className?: string
}

export function MarkdownEditor({ content, onChange, className }: MarkdownEditorProps) {
  const [isPreview, setIsPreview] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-400 hover:underline',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-md max-w-full h-auto',
        },
      }),
      Markdown,
    ],
    content,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-invert max-w-none min-h-[200px] p-4',
          'border border-gray-700 rounded-md bg-black/30 text-gray-100',
          '[&_pre]:bg-black/50 [&_pre]:p-4 [&_pre]:rounded-md',
          '[&_code]:bg-black/50 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-sm',
          className
        ),
      },
    },
    onUpdate: ({ editor }) => {
      // HTML 대신 마크다운 텍스트로 저장
      const markdown = editor.storage.markdown.getMarkdown()
      onChange(markdown)
    },
  })

  const handlePreviewToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsPreview(!isPreview)
  }

  return (
    <div 
      className="markdown-editor w-full"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-end mb-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handlePreviewToggle}
          className="text-gray-400"
        >
          {isPreview ? (
            <>
              <EyeOff className="h-4 w-4 mr-2" />
              <span>편집하기</span>
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 mr-2" />
              <span>미리보기</span>
            </>
          )}
        </Button>
      </div>
      
      <div onClick={(e) => e.stopPropagation()}>
        {!isPreview ? (
          <>
            <Toolbar editor={editor} />
            <EditorContent editor={editor} />
          </>
        ) : (
          <MarkdownPreview content={editor?.storage.markdown.getMarkdown() || ''} />
        )}
      </div>
    </div>
  )
}