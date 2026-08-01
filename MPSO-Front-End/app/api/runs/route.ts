import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createMpsoRun, listMpsoRuns } from '@/lib/server/mpso-database'
import { enqueueMpsoRun } from '@/lib/server/mpso-runner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const createRunSchema = z.object({
  protocol: z.enum([
    '隐私集合求交集',
    '隐私集合求并集',
    '隐私集合求交集数量',
    '隐私集合求交集的和',
  ]),
  parties: z.coerce.number().int().min(2).max(10),
  dataset: z.enum(['all', '12', '14', '16', '18', '20']),
  threads: z.coerce.number().int().min(1).max(64).default(4),
})

export async function POST(request: Request) {
  try {
    const parsed = createRunSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: '运行参数无效', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const id = randomUUID()
    await createMpsoRun({ id, ...parsed.data })
    enqueueMpsoRun(id)
    return NextResponse.json({ id, status: 'queued', phase: 'queued' }, { status: 202 })
  } catch (error) {
    const message = error instanceof Error ? error.message : '无法创建运行任务'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') ?? 30)
    const runs = await listMpsoRuns(limit)
    return NextResponse.json({ runs })
  } catch (error) {
    const message = error instanceof Error ? error.message : '无法读取历史任务'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
