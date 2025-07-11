'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { GuideSection } from '@/lib/types/guide'
import { DocumentIcon } from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'

interface AdminGuideListProps {
  sections: GuideSection[]
}

export function AdminGuideList({ sections }: AdminGuideListProps) {
  const router = useRouter()

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {sections.map((section, index) => (
        <motion.div
          key={section.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card className="h-full bg-black/40 backdrop-blur-sm border border-gray-400/20 shadow-xl hover:border-gray-400/40 transition-all duration-300">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
                  <DocumentIcon className="h-6 w-6" />
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
            <CardContent className="flex justify-end">
              <Button 
                variant="outline" 
                onClick={() => router.push(`/admin/guides/sections/${section.id}`)}
                className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
              >
                관리하기
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  )
} 