'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle } from 'lucide-react'

interface TradeAlertProps {
  isOpen: boolean
  type: 'buy' | 'sell'
  onClose: () => void
}

export function TradeAlert({ isOpen, type, onClose }: TradeAlertProps) {
  return (
    <AnimatePresence mode="popLayout">
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="fixed left-[45%] top-[45%] -translate-x-[50%] -translate-y-[50%] 
                       bg-gray-900 rounded-2xl p-8 shadow-2xl z-[101] w-[90%] max-w-[360px]
                       border border-gray-800"
          >
            <div className="flex flex-col items-center gap-5">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
                className="rounded-full bg-gray-800/50 p-4"
              >
                <CheckCircle 
                  className={`w-12 h-12 ${
                    type === 'buy' 
                      ? 'text-blue-400' 
                      : 'text-red-400'
                  }`} 
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col items-center gap-2"
              >
                <h2 className="text-2xl font-bold text-white">
                  {type === 'buy' ? '매수 완료' : '매도 완료'}
                </h2>
                <p className="text-gray-400 text-center">
                  {type === 'buy' 
                    ? '주문하신 매수가 정상적으로 처리되었습니다.' 
                    : '주문하신 매도가 정상적으로 처리되었습니다.'}
                </p>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
} 