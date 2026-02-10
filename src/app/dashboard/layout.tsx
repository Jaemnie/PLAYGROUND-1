import { MissionPanel } from '@/components/ui/mission-panel'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
      <MissionPanel />
    </>
  )
}
