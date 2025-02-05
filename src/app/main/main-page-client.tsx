'use client'

import { useEffect, useState } from 'react'
import Link from "next/link"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { motion } from "framer-motion"
import { DocumentIcon, Cog6ToothIcon } from "@heroicons/react/24/outline"
import { LogoutButton } from "@/components/logout-button"
import { createClientBrowser } from '@/lib/supabase/client'
import { GuideSection } from '@/lib/types/guide'
import { adminguide } from '@/lib/actions/auth'
import { useRouter } from 'next/navigation'

interface MainPageClientProps {
  initialSections: GuideSection[]
  initialIsAdmin: boolean
}

export function MainPageClient({ initialSections, initialIsAdmin }: MainPageClientProps) {
  const router = useRouter()
  const [sections, setSections] = useState<GuideSection[]>(
    initialSections.map(section => ({
      ...section,
      icon: <DocumentIcon className="h-6 w-6" />,
      items: []
    }))
  )
  const supabase = createClientBrowser()

  const loadGuideItems = async () => {
    try {
      const sectionsWithItems = await Promise.all(
        sections.map(async (section) => {
          const { data: itemsData, error: itemsError } = await supabase
            .from('guide_items')
            .select('*')
            .eq('section_id', section.id)
            .order('created_at', { ascending: true })

          if (itemsError) throw itemsError

          return {
            ...section,
            items: itemsData?.map(item => ({
              id: item.id,
              name: item.title,
              description: item.description,
              href: `/guides/${item.id}`
            })) || []
          }
        })
      )

      setSections(sectionsWithItems)
    } catch (error) {
      console.error('가이드 아이템 로딩 에러:', error)
    }
  }

  useEffect(() => {
    let isMounted = true
    
    const loadData = async () => {
      try {
        if (sections.length > 0) {
          await loadGuideItems()
        }
      } catch (error) {
        console.error('Data loading error:', error)
      }
    }

    if (isMounted) loadData()
    
    return () => {
      isMounted = false
    }
  }, [sections.length, loadGuideItems])

  const scrollToGuides = () => {
    const guidesSection = document.querySelector('#guides-section')
    if (guidesSection) {
      guidesSection.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="fixed top-4 right-4 z-50 flex items-center gap-4">
        <LogoutButton />
        {initialIsAdmin && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Button
              variant="ghost"
              size="icon"
              className="relative bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/50 hover:bg-zinc-800/70"
              onClick={() => adminguide()}
            >
              <Cog6ToothIcon className="h-[1.2rem] w-[1.2rem] text-zinc-200" />
              <span className="sr-only">관리자 페이지</span>
            </Button>
          </motion.div>
        )}
      </div>
      {/* Hero 섹션 */}
      <section className="relative h-[70vh] overflow-hidden bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        <div className="relative container mx-auto h-full flex flex-col items-center justify-center text-center space-y-8 px-4">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-400"
          >
            플랫폼 이름
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg sm:text-xl text-gray-400 max-w-2xl"
          >
            플랫폼에 대한 간단한 설명이 들어갑니다.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex gap-4 mt-8"
          >
            <Button 
              size="lg"
              className="bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white"
              onClick={() => router.push('/dashboard')}
            >
              시작하기
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
              onClick={scrollToGuides}
            >
              더 알아보기
            </Button>
          </motion.div>
        </div>
      </section>

      {/* 가이드 섹션 */}
      <section id="guides-section" className="py-20 px-4 bg-black/40">
        <div className="container mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              가이드
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              필요한 모든 정보를 찾아보세요
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sections.map((section) => (
              <Card key={section.id} className="bg-black/40 backdrop-blur-sm border border-gray-400/50 shadow-xl">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg text-violet-400">
                      {section.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-100">
                        {section.title}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {section.description}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {section.items.map((item) => (
                      <li key={item.id}>
                        {item.href ? (
                          <Link 
                            href={item.href}
                            className="group flex flex-col space-y-1 hover:bg-accent/50 p-3 rounded-lg transition-colors"
                          >
                            <span className="font-medium text-card-foreground group-hover:text-accent-foreground">
                              {item.name}
                            </span>
                            {item.description && (
                              <span className="text-sm text-muted-foreground">
                                {item.description}
                              </span>
                            )}
                          </Link>
                        ) : (
                          <span className="block p-3 text-muted-foreground">
                            {item.name}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  )
} 