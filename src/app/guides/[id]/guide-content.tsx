'use client'

import { Card } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { MarkdownPreview } from '@/components/markdown-editor/markdown-preview'

interface GuideContentProps {
  item: {
    title: string
    description: string
    content: string
  }
}

export function GuideContent({ item }: GuideContentProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="max-w-4xl mx-auto bg-black/40 backdrop-blur-sm border border-gray-400/50 shadow-xl">
        <div className="p-8">
          <h1 className="text-3xl font-bold text-gray-100 mb-4">
            {item.title}
          </h1>
          <p className="text-gray-400 mb-8">
            {item.description}
          </p>
          <div className="prose prose-invert max-w-none">
            <MarkdownPreview content={item.content} />
          </div>
        </div>
      </Card>
    </motion.div>
  )
} 