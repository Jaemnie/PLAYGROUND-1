'use client'

import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { logout } from '@/lib/actions/auth'

export function LogoutButton() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <form action={logout}>
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="bg-black/40 backdrop-blur-sm border border-red-800/50 hover:bg-red-950/50 text-red-400 hover:text-red-300"
        >
          <LogOut className="h-4 w-4 mr-2" />
          로그아웃
        </Button>
      </form>
    </motion.div>
  )
} 