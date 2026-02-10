'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Gem, CheckCircle2, Clock, CalendarCheck } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

interface Mission {
  id: string
  progress: number
  max_progress: number
  is_completed: boolean
  reward_claimed: boolean
  expires_at: string
  mission_template: {
    name: string
    description: string
    category: string
    reward_gems: number
    reward_rp: number
    difficulty: string
  }
}

interface CheckIn {
  checked_in_at: string
  streak: number
  reward_gems: number
}

const difficultyColors: Record<string, string> = {
  easy: 'text-green-400',
  medium: 'text-yellow-400',
  hard: 'text-red-400',
}

export function MissionPanel() {
  const [missions, setMissions] = useState<Mission[]>([])
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchMissions()
    fetchCheckIns()
  }, [])

  const fetchMissions = async () => {
    const res = await fetch('/api/missions')
    const data = await res.json()
    setMissions(data.missions || [])
  }

  const fetchCheckIns = async () => {
    const res = await fetch('/api/checkin')
    const data = await res.json()
    setCheckIns(data.checkIns || [])
  }

  const handleCheckIn = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/checkin', { method: 'POST' })
      const data = await res.json()

      if (data.alreadyCheckedIn) {
        toast.info('오늘은 이미 출석했습니다!')
      } else {
        toast.success(`출석 완료! ${data.streak}일 연속 (${data.gems}젬 획득)`)
        fetchCheckIns()
      }
    } catch {
      toast.error('출석 체크 실패')
    }
    setLoading(false)
  }

  const handleClaimReward = async (missionId: string) => {
    const res = await fetch('/api/missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mission_id: missionId }),
    })
    const data = await res.json()

    if (data.success) {
      toast.success(`미션 보상 수령! ${data.gems}젬 획득`)
      fetchMissions()
    } else {
      toast.error('보상 수령 실패')
    }
  }

  const dailyMissions = missions.filter(m => m.mission_template?.category === 'daily')
  const weeklyMissions = missions.filter(m => m.mission_template?.category === 'weekly')
  const todayCheckedIn = checkIns.some(c => c.checked_in_at === new Date().toISOString().split('T')[0])
  const currentStreak = checkIns.length > 0 ? checkIns[0].streak : 0

  return (
    <>
      {/* 플로팅 버튼 */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-500/30 flex items-center justify-center"
      >
        <CalendarCheck className="w-6 h-6 text-white" />
        {missions.filter(m => m.is_completed && !m.reward_claimed).length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
            {missions.filter(m => m.is_completed && !m.reward_claimed).length}
          </span>
        )}
      </motion.button>

      {/* 미션 패널 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 w-[360px] max-h-[500px] overflow-y-auto"
          >
            <Card className="rounded-2xl bg-zinc-900/95 backdrop-blur-xl border border-zinc-800/50 p-4 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-100">미션 & 출석</h3>
                <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-300 text-xl">&times;</button>
              </div>

              {/* 출석 체크 */}
              <div className="mb-4 p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-300">출석 체크</span>
                  <span className="text-xs text-violet-400">{currentStreak}일 연속</span>
                </div>
                <Button
                  size="sm"
                  onClick={handleCheckIn}
                  disabled={todayCheckedIn || loading}
                  className={`w-full ${todayCheckedIn ? 'bg-zinc-700 text-zinc-400' : 'bg-violet-600 hover:bg-violet-700'}`}
                >
                  {todayCheckedIn ? '출석 완료!' : '출석하기'}
                </Button>
              </div>

              {/* 일일 미션 */}
              {dailyMissions.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">일일 미션</p>
                  <div className="space-y-2">
                    {dailyMissions.map(mission => (
                      <MissionItem key={mission.id} mission={mission} onClaim={handleClaimReward} />
                    ))}
                  </div>
                </div>
              )}

              {/* 주간 미션 */}
              {weeklyMissions.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">주간 미션</p>
                  <div className="space-y-2">
                    {weeklyMissions.map(mission => (
                      <MissionItem key={mission.id} mission={mission} onClaim={handleClaimReward} />
                    ))}
                  </div>
                </div>
              )}

              {dailyMissions.length === 0 && weeklyMissions.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">배정된 미션이 없습니다</p>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function MissionItem({ mission, onClaim }: { mission: Mission; onClaim: (id: string) => void }) {
  const template = mission.mission_template
  const progressPct = mission.max_progress > 0 ? (mission.progress / mission.max_progress) * 100 : 0

  return (
    <div className="p-2.5 rounded-lg bg-zinc-800/40 border border-zinc-700/30">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-200 truncate">{template.name}</p>
          <p className="text-[10px] text-gray-500">{template.description}</p>
        </div>
        <span className={`text-[10px] font-bold shrink-0 ${difficultyColors[template.difficulty]}`}>
          {template.difficulty === 'easy' ? '쉬움' : template.difficulty === 'medium' ? '보통' : '어려움'}
        </span>
      </div>

      {/* 진행도 */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${mission.is_completed ? 'bg-green-500' : 'bg-violet-500'}`}
            style={{ width: `${Math.min(progressPct, 100)}%` }}
          />
        </div>
        <span className="text-[10px] text-gray-500 shrink-0">
          {mission.progress}/{mission.max_progress}
        </span>
      </div>

      {/* 보상 / 수령 버튼 */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[10px] text-amber-300">
          <Gem className="w-3 h-3" />
          {template.reward_gems}젬
        </span>

        {mission.is_completed && !mission.reward_claimed ? (
          <button
            onClick={() => onClaim(mission.id)}
            className="text-[10px] px-2 py-0.5 rounded bg-green-600 hover:bg-green-700 text-white font-medium"
          >
            수령
          </button>
        ) : mission.reward_claimed ? (
          <span className="flex items-center gap-1 text-[10px] text-green-400">
            <CheckCircle2 className="w-3 h-3" />
            완료
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-gray-500">
            <Clock className="w-3 h-3" />
            진행중
          </span>
        )}
      </div>
    </div>
  )
}
