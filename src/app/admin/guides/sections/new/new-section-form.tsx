'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { toast } from 'sonner'
import { User } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { DashboardBackButton } from '@/components/back-button'

interface NewSectionFormProps {
  user: User
}

export function NewSectionForm({ user }: NewSectionFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState({
    title: '',
    description: ''
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/guides/sections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          created_by: user.id
        }),
      })

      if (!response.ok) throw new Error('섹션 생성에 실패했습니다')

      toast.success('섹션이 생성되었습니다')
      router.push('/admin/guides')
      router.refresh()
    } catch (error) {
      console.error('Error:', error)
      toast.error('섹션 생성에 실패했습니다')
    } finally {
      setIsLoading(false)
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
            새 섹션 만들기
          </motion.h1>
        </div>
      </section>
      
      <section className="py-20 px-4 bg-black/40">
        <div className="container mx-auto max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-black/40 backdrop-blur-sm border border-gray-400/50 shadow-xl">
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-6 pt-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-200">제목</label>
                    <Input
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      required
                      placeholder="섹션 제목을 입력하세요"
                      className="border-gray-700 bg-gray-900/50 text-gray-100 placeholder:text-gray-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-200">설명</label>
                    <Textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      required
                      placeholder="섹션에 대한 설명을 입력하세요"
                      className="border-gray-700 bg-gray-900/50 text-gray-100 placeholder:text-gray-500 min-h-[120px]"
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
                    {isLoading ? '생성 중...' : '생성하기'}
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