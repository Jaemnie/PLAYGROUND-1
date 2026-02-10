'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { motion } from 'framer-motion'

interface User {
  id: string
  nickname?: string
  points: number
  stock_value: number
  total_capital: number
}

interface LeaderboardClientProps {
  users: User[]
}

export function LeaderboardClient({ users }: LeaderboardClientProps) {
  const router = useRouter()

  // 숫자를 정수로 변환하여 표시하는 함수
  const formatNumber = (num: number) => {
    return Math.round(num).toLocaleString()
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 left-4 z-50">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Button
            type="button"
            className="relative bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/50 hover:bg-zinc-800/70 flex items-center gap-2"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeftIcon className="h-[1.2rem] w-[1.2rem] text-zinc-200" />
            <span className="text-zinc-200">대시보드</span>
          </Button>
        </motion.div>
      </div>

      {/* 컴팩트 헤더 */}
      <section className="pt-20 pb-8 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-sm font-bold tracking-widest text-violet-400 mb-1">
              STACKS
            </p>
            <h1 className="text-2xl font-bold text-gray-100">
              랭킹 리더보드
            </h1>
          </motion.div>
        </div>
      </section>

      <section className="px-4 pb-12">
        <div className="container mx-auto max-w-5xl">
        <Card className="rounded-2xl bg-black/40 backdrop-blur-sm border border-gray-800/50 p-6 overflow-hidden">
          <h2 className="text-xl font-semibold text-gray-100 mb-6">전체 사용자 랭킹</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800">
                  <TableHead className="text-gray-300">순위</TableHead>
                  <TableHead className="text-gray-300">사용자명</TableHead>
                  <TableHead className="text-gray-300 text-right">포인트</TableHead>
                  <TableHead className="text-gray-300 text-right">주식 자산</TableHead>
                  <TableHead className="text-gray-300 text-right">총 자본</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user, index) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="border-gray-800"
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        {index < 3 ? (
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full mr-2 ${
                            index === 0 ? 'bg-yellow-500/20 text-yellow-300' : 
                            index === 1 ? 'bg-gray-400/20 text-gray-300' : 
                            'bg-amber-700/20 text-amber-600'
                          }`}>
                            {index + 1}
                          </span>
                        ) : (
                          <span className="w-8 text-center mr-2">{index + 1}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{user.nickname || '이름 없음'}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(user.points)} P
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(user.stock_value)} P
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      <span className={index < 3 ? 'text-blue-400' : ''}>
                        {formatNumber(user.total_capital)} P
                      </span>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
        </div>
      </section>
    </div>
  )
}

export default LeaderboardClient 