export interface GuideSection {
  id: string
  title: string
  description: string
  created_at: string
  icon?: React.ReactNode
  items: GuideItem[]
}

export interface GuideItem {
  id: string
  name: string
  description: string
  href?: string
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