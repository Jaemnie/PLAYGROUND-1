'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import DashboardBackButton from '@/components/DashboardBackButton'

const MarkdownEditor = dynamic(
  () => import('@/components/markdown-editor/markdown-editor').then(mod => mod.MarkdownEditor),
  { ssr: false }
)

interface EditItemFormProps {
  item: {
    id: string
    title: string
    description: string
    content: string
  }
  sectionId: string
}

export function EditItemForm({ item, sectionId }: EditItemFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState({
    title: item.title,
    description: item.description,
    content: item.content
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleContentChange = (newContent: string) => {
    setFormData(prev => ({ ...prev, content: newContent }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    setIsLoading(true)
  
    if (!formData.title.trim() || !formData.description.trim() || !formData.content.trim()) {
      toast.error('모든 필드를 입력해주세요')
      setIsLoading(false)
      setIsSubmitting(false)
      return
    }
  
    try {
      const response = await fetch(`/api/guides/items/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim(),
          content: formData.content
        }),
      })
  
      if (!response.ok) throw new Error('아이템 수정에 실패했습니다')
  
      toast.success('아이템이 수정되었습니다')
      router.push(`/admin/guides/sections/${sectionId}`)
      router.refresh()
    } catch (error) {
      console.error('Error:', error)
      toast.error(error instanceof Error ? error.message : '아이템 수정에 실패했습니다')
    } finally {
      setIsLoading(false)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="fixed top-4 left-4 z-50">
        <DashboardBackButton />
      </div>
      <section className="relative h-[40vh] overflow-hidden bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        <div className="relative container mx-auto h-full flex flex-col items-center justify-center text-center space-y-8 px-4">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-400"
          >
            아이템 수정
          </motion.h1>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="container mx-auto max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-black/40 backdrop-blur-sm border border-gray-400/50 shadow-xl">
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4 pt-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-200">제목</label>
                    <Input
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      required
                      className="bg-black/30 border-gray-700 text-gray-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-200">설명</label>
                    <Input
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      required
                      className="bg-black/30 border-gray-700 text-gray-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-200">내용</label>
                    <MarkdownEditor
                      content={formData.content}
                      onChange={handleContentChange}
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    className="border-gray-700 text-gray-300 hover:bg-gray-800"
                  >
                    취소
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white"
                  >
                    {isLoading ? '저장 중...' : '저장하기'}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </motion.div>
        </div>
      </section>
    </div>
  )
} 