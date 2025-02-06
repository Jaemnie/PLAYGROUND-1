'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowPathIcon } from '@heroicons/react/24/outline'

interface SchedulerStatus {
  id: string;
  status: 'running' | 'stopped' | 'error';
  lastRun: Date | null;
  nextRun: Date | null;
  errorMessage?: string;
  jobType: 'market_update' | 'news_generation' | 'price_update';
}

export function SchedulerMonitor() {
  const [status, setStatus] = useState<SchedulerStatus[]>([])
  
  useEffect(() => {
    const fetchStatus = async () => {
      const response = await fetch('/api/scheduler/status')
      const data = await response.json()
      setStatus(data.status)
    }
    
    fetchStatus()
    const interval = setInterval(fetchStatus, 30000) // 30초마다 갱신
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-gray-800 bg-black/40 backdrop-blur-sm"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-400">
            시스템 모니터링
          </h2>
          <ArrowPathIcon className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
        <div className="grid gap-4">
          {status.map(job => (
            <motion.div
              key={job.id}
              className="p-4 rounded-lg border border-gray-800/50 bg-gray-900/50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    job.status === 'running' ? 'bg-green-500' :
                    job.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                  }`} />
                  <span className="font-medium text-gray-200">
                    {job.jobType === 'market_update' ? '시장 업데이트' :
                     job.jobType === 'news_generation' ? '뉴스 생성' : '가격 업데이트'}
                  </span>
                </div>
                <span className={`text-sm ${
                  job.status === 'running' ? 'text-green-400' :
                  job.status === 'error' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {job.status === 'running' ? '실행 중' :
                   job.status === 'error' ? '오류' : '중지됨'}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-gray-400">
                <p>마지막 실행: {job.lastRun ? new Date(job.lastRun).toLocaleString() : '없음'}</p>
                <p>다음 실행: {job.nextRun ? new Date(job.nextRun).toLocaleString() : '없음'}</p>
                {job.errorMessage && (
                  <p className="text-red-400 mt-2">{job.errorMessage}</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}