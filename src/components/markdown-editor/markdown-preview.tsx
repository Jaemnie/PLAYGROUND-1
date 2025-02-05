'use client'

import { marked } from 'marked'

interface MarkdownPreviewProps {
  content: string
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <div 
      className="prose prose-invert max-w-none min-h-[200px] p-4 bg-black/30 border border-gray-700 rounded-md text-gray-100"
      onClick={(e) => e.preventDefault()}
      dangerouslySetInnerHTML={{ __html: marked(content) }}
    />
  )
} 