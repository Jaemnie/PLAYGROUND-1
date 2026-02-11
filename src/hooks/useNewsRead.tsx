'use client'

import { useEffect, useRef, useState } from 'react'
import { reportNewsRead } from '@/lib/report-news-read'

/** 뉴스가 화면에 보인 상태로 일정 시간 유지 시 읽음 처리 */
const READ_DELAY_MS = 1500

/**
 * 뉴스 읽음 추적 훅
 * @param newsId - 뉴스 ID
 * @param isVisible - 뉴스가 사용자에게 보이는지 (viewport 내, 또는 carousel에서 선택됨)
 */
export function useNewsRead(newsId: string | null, isVisible: boolean) {
  const reportedIds = useRef<Set<string>>(new Set())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!newsId || !isVisible) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }

    if (reportedIds.current.has(newsId)) return

    timerRef.current = setTimeout(() => {
      reportedIds.current.add(newsId)
      reportNewsRead(newsId)
      timerRef.current = null
    }, READ_DELAY_MS)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [newsId, isVisible])
}

/** ref로 연결된 요소가 viewport에 보이는지 추적 */
export function useInView(threshold = 0.3) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const io = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold, rootMargin: '50px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])

  return { ref, isVisible }
}

/** 뉴스 카드 감싸기 - viewport에 보이면 읽음 처리 */
export function NewsReadTracker({
  newsId,
  children,
}: {
  newsId: string
  children: React.ReactNode
}) {
  const { ref, isVisible } = useInView(0.2)
  useNewsRead(newsId, isVisible)
  return <div ref={ref}>{children}</div>
}
