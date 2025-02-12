'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import { GuideSection, GuideItem } from '@/lib/types/guide'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { DashboardBackButton } from '@/components/DashboardBackButton'

interface SectionItemsProps {
  section: GuideSection
  items: GuideItem[]
  sectionId: string
}

export function SectionItems({ section, items, sectionId }: SectionItemsProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteSection = async () => {
    if (!window.confirm('정말로 이 섹션을 삭제하시겠습니까?')) return
    
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/guides/sections/${sectionId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('섹션 삭제에 실패했습니다')

      toast.success('섹션이 삭제되었습니다')
      router.push('/admin/guides')
      router.refresh()
    } catch (error) {
      console.error('Error:', error)
      toast.error('섹션 삭제에 실패했습니다')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm('정말로 이 아이템을 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/guides/items/${itemId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('아이템 삭제에 실패했습니다')

      toast.success('아이템이 삭제되었습니다')
      router.refresh()
    } catch (error) {
      console.error('Error:', error)
      toast.error('아이템 삭제에 실패했습니다')
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
            {section.title}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-gray-400"
          >
            {section.description}
          </motion.p>
        </div>
      </section>

      <section className="py-20 px-4 bg-black/40">
        <div className="container mx-auto max-w-4xl">
          <div className="flex justify-between items-center mb-8">
            <Button
              onClick={() => router.push(`/admin/guides/sections/${sectionId}/items/new`)}
              className="bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              새 아이템 추가
            </Button>
            <div className="space-x-4">
              <Button
                variant="outline"
                onClick={() => router.push(`/admin/guides/sections/${sectionId}/edit`)}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                <PencilIcon className="w-5 h-5 mr-2" />
                섹션 수정
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteSection}
                disabled={isDeleting}
              >
                <TrashIcon className="w-5 h-5 mr-2" />
                섹션 삭제
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {items.map((item) => (
              <Card key={item.id} className="bg-black/40 backdrop-blur-sm border border-gray-400/50 shadow-xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-100">
                        {item.title}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {item.description}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/admin/guides/sections/${sectionId}/items/${item.id}/edit`)}
                        className="border-gray-700 text-gray-300 hover:bg-gray-800"
                      >
                        <PencilIcon className="w-4 h-4 mr-2" />
                        수정
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        <TrashIcon className="w-4 h-4 mr-2" />
                        삭제
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
} 