import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const data = await request.json()
    const resolvedParams = await params

    const { error } = await supabase
      .from('guide_items')
      .update(data)
      .eq('id', resolvedParams.id)

    if (error) throw error

    return NextResponse.json({ message: '아이템이 수정되었습니다' })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: '아이템 수정에 실패했습니다' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const resolvedParams = await params

    const { error } = await supabase
      .from('guide_items')
      .delete()
      .eq('id', resolvedParams.id)

    if (error) throw error

    return NextResponse.json({ message: '아이템이 삭제되었습니다' })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: '아이템 삭제에 실패했습니다' },
      { status: 500 }
    )
  }
} 