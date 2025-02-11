import { motion, AnimatePresence } from 'framer-motion'
import { Button } from './button'
import { Card, CardContent, CardFooter } from './card'

interface AlertDialogProps {
  isOpen: boolean
  message: string
  onClose: () => void
}

export function AlertDialog({ isOpen, message, onClose }: AlertDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
          >
            <Card className="w-[320px] bg-black/40 backdrop-blur-sm border border-gray-800/50 shadow-xl">
              <CardContent className="pt-6">
                <p className="text-center text-gray-200">{message}</p>
              </CardContent>
              <CardFooter className="justify-center">
                <Button
                  onClick={onClose}
                  className="bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600"
                >
                  확인
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
} 