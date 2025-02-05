export interface GuideSection {
  id: string
  title: string
  description: string
  created_at: string
  icon?: React.ReactNode
  items: Array<{
    id: string
    name: string
    description?: string
    href?: string
  }>
}

export interface GuideItem {
  id: string
  title: string
  description: string
  content: string
  section_id: string
  created_at: string
}

export interface StockData {
  id: string
  ticker: string
  name: string
  price: number
  change: number
  volume: number
  market_cap: number
}

export interface UserProfile {
  id: string
  points: number
  user_id: string
}

export interface AdminUser {
  id: string
  user_id: string
  created_at: string
}

export interface EditItemFormProps {
  item: GuideItem
  sectionId: string
}

export interface SectionItemsProps {
  section: GuideSection
  items: GuideItem[]
  sectionId: string
}