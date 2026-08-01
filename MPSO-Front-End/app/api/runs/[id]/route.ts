import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getMpsoRun } from '@/lib/server/mpso-database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const idSchema = z.string().uuid()

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    if (!idSchema.safeParse(id).success) {
      return NextResponse.json({ error: '任务 ID 无效' }, { status: 400 })
    }
    const run = await getMpsoRun(id)
    if (!run) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 })
    }
    return NextResponse.json(run)
  } catch (error) {
    const message = error instanceof Error ? error.message : '无法读取运行任务'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
