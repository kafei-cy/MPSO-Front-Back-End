import { arch, cpus, freemem, platform, release, totalmem } from 'node:os'
import { NextResponse } from 'next/server'
import { checkMpsoDatabase } from '@/lib/server/mpso-database'
import { checkMpsoExecutables, taihangPsoExecutable } from '@/lib/server/mpso-runner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function testMemoryGiB() {
  const configured = Number(process.env.MPSO_TEST_MEMORY_GIB ?? 64)
  return Number.isFinite(configured) && configured > 0 ? configured : 64
}

export async function GET() {
  try {
    const [database, buildDirectory] = await Promise.all([
      checkMpsoDatabase(),
      checkMpsoExecutables(),
    ])
    return NextResponse.json({
      status: 'ok',
      database,
      mpsoBuildDirectory: buildDirectory,
      taihangPsoExecutable: taihangPsoExecutable(),
      machine: {
        cpuModel: cpus()[0]?.model.replace(/\s+/g, ' ').trim() ?? '未知 CPU',
        logicalCores: cpus().length,
        memoryTotalGiB: Number((totalmem() / 1024 ** 3).toFixed(1)),
        memoryAvailableGiB: Number((freemem() / 1024 ** 3).toFixed(1)),
        testMemoryGiB: testMemoryGiB(),
        system: `${platform()} ${release()}`,
        architecture: arch(),
        observedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '后端健康检查失败'
    return NextResponse.json({ status: 'error', error: message }, { status: 503 })
  }
}
