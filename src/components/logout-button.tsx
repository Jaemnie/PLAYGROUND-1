'use client'

import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"

export function LogoutButton() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed top-4 left-4 z-50"
    >
      <form action="/api/auth/logout" method="post">
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          className="relative bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/50 hover:bg-zinc-800/70"
        >
          <LogOut className="h-[1.2rem] w-[1.2rem] text-zinc-200" />
          <span className="sr-only">로그아웃</span>
        </Button>
      </form>
    </motion.div>
  )
} 