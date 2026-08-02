import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BarChart3, CheckCircle2, Clock, Gauge, Radio, RotateCcw, Table2 } from 'lucide-react'
import Footer from '@/components/sections/footer'
import { Button } from '@/components/ui/button'
import {
  buildBenchmarkView,
  type BaselineStatus,
  type BenchmarkRow,
  formatDatasetLabel,
  formatMiB,
  formatRatio,
  formatSeconds,
  protocolKeyFromLabel,
} from '@/lib/mpso-results'
import { getMpsoRun, type MpsoRunSample } from '@/lib/server/mpso-database'

type ResultsSearchParams = Promise<Record<string, string | string[] | undefined>>

function firstParam(value: string | string[] | undefined, fallback: string) {
  if (Array.isArray(value)) {
    return value[0] ?? fallback
  }
  return value ?? fallback
}

function metricValue(row: BenchmarkRow, metric: 'time' | 'comm', kind: 'ours' | 'baseline') {
  if (metric === 'time') {
    return kind === 'ours' ? row.oursTime : row.baselineTime
  }
  return kind === 'ours' ? row.oursComm : row.baselineComm
}

function liveBenchmarkRow(sample: MpsoRunSample, baselineStatus: BaselineStatus): BenchmarkRow {
  const oursTime = sample.oursOnlineMs / 1000
  const baselineTime = sample.sotaOnlineMs === null ? null : sample.sotaOnlineMs / 1000
  const timeRatio = baselineTime && oursTime ? baselineTime / oursTime : null
  const commRatio = sample.oursCommMiB && sample.sotaCommMiB
    ? sample.sotaCommMiB / sample.oursCommMiB
    : null
  return {
    power: sample.datasetPower,
    setSize: sample.setSize,
    setLabel: `2^${sample.datasetPower}`,
    oursTime,
    baselineTime,
    timeRatio,
    oursComm: sample.oursCommMiB,
    baselineComm: sample.sotaCommMiB,
    commRatio,
    baselineStatus,
  }
}

function valueSummary(values: Array<number | null>, formatter: (value: number) => string) {
  const available = values.filter((value): value is number => value !== null && Number.isFinite(value))
  if (!available.length) return 'N/A'
  if (available.length === 1) return formatter(available[0])
  return `${formatter(Math.min(...available))} - ${formatter(Math.max(...available))}`
}

function liveOutput(protocol: string, samples: MpsoRunSample[], parties: number) {
  const values = samples.map((sample) => {
    const key = sample.resultType === 'intersection-sum' ? 'sum' : 'count'
    return Number(sample.resultValue[key] ?? 0)
  })
  const value = values.length === 1
    ? values[0].toLocaleString()
    : `${Math.min(...values).toLocaleString()} - ${Math.max(...values).toLocaleString()}`

  if (protocol === '隐私集合求并集') {
    return { primary: `${value} 个并集元素`, subtitle: `${parties === 2 ? 'Taihang PSO' : 'MPSO'} 后端真实运行结果` }
  }
  if (protocol === '隐私集合求交集数量') {
    return { primary: value, subtitle: `${parties === 2 ? 'Taihang PSO' : 'MPSO'} 后端返回的真实交集数量` }
  }
  if (protocol === '隐私集合求交集的和') {
    return { primary: value, subtitle: `${parties === 2 ? 'Taihang PSO' : 'MPSO'} 后端返回的真实求和值` }
  }
  return { primary: `${value} 个共同元素`, subtitle: `${parties === 2 ? 'Taihang PSO' : 'MPSO'} 后端真实运行结果` }
}

function metricText(value: number | null | undefined, metric: 'time' | 'comm', baselineStatus?: BaselineStatus) {
  if (value === null || value === undefined) {
    if (baselineStatus === 'oom') return 'OOM'
    if (baselineStatus === 'unpublished') return '未公开实现'
    if (baselineStatus === 'missing') return '数据缺失'
  }
  return metric === 'time' ? formatSeconds(value) : formatMiB(value)
}

function metricRatio(row: BenchmarkRow, metric: 'time' | 'comm') {
  return metric === 'time'
    ? formatRatio(row.timeRatio, '更快', '更慢')
    : formatRatio(row.commRatio, '更低', '更高')
}

type Advantage = {
  metric: 'time' | 'comm'
  ratio: number
}

function bestAdvantage(rows: BenchmarkRow[]): Advantage | null {
  const candidates = rows.flatMap((row) => {
    const items: Advantage[] = []
    if (row.timeRatio && row.timeRatio > 1) {
      items.push({ metric: 'time', ratio: row.timeRatio })
    }
    if (row.commRatio && row.commRatio > 1) {
      items.push({ metric: 'comm', ratio: row.commRatio })
    }
    return items
  })
  if (!candidates.length) return null
  return candidates.reduce((best, item) => (item.ratio > best.ratio ? item : best), candidates[0])
}

function BenchmarkBars({ rows, metric, title }: { rows: BenchmarkRow[]; metric: 'time' | 'comm'; title: string }) {
  const values = rows.flatMap((row) => [metricValue(row, metric, 'ours'), metricValue(row, metric, 'baseline')])
  const numericValues = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value))
  const maxValue = Math.max(...numericValues, 1)
  const hasBaseline = rows.some((row) => metricValue(row, metric, 'baseline') !== null)
  const subtitle = hasBaseline
    ? metric === 'time' ? '越短越好，Ours 与 SOTA 直接对比' : '越低越好，Ours 与 SOTA 直接对比'
    : '本次运行未接入 SOTA，对照列显示 N/A'

  return (
      <div className="surface-card group rounded-lg border border-border bg-card p-6 2xl:p-7">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h4 className="text-2xl font-semibold text-foreground">{title}</h4>
          <p className="mt-1 text-lg text-muted-foreground">{subtitle}</p>
        </div>
        <span className="rounded border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-base text-primary">
          {rows.length === 1 ? metricRatio(rows[0], metric) : '全规模曲线'}
        </span>
      </div>

      <div className="space-y-4">
        {rows.map((row) => {
          const ours = metricValue(row, metric, 'ours')
          const baseline = metricValue(row, metric, 'baseline')
          const oursWidth = ours ? Math.max(4, (ours / maxValue) * 100) : 0
          const baselineWidth = baseline ? Math.max(4, (baseline / maxValue) * 100) : 0

          return (
            <div key={`${row.setLabel}-${metric}`} className="grid gap-2">
              <div className="flex items-center justify-between gap-3 text-lg">
                <span className="font-mono text-accent">{row.setLabel}</span>
                <span className="font-mono text-primary">{metricRatio(row, metric)}</span>
              </div>
              <div className="grid gap-2">
                <div className="grid grid-cols-[64px_1fr_112px] items-center gap-3 text-lg">
                  <span className="text-muted-foreground">Ours</span>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${oursWidth}%` }} />
                  </div>
                  <span className="text-right font-mono text-foreground">{metricText(ours, metric)}</span>
                </div>
                <div className="grid grid-cols-[64px_1fr_112px] items-center gap-3 text-lg">
                  <span className="text-muted-foreground">SOTA</span>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-zinc-500" style={{ width: `${baselineWidth}%` }} />
                  </div>
                  <span className="text-right font-mono text-muted-foreground">{metricText(baseline, metric, row.baselineStatus)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default async function Results({ searchParams }: { searchParams?: ResultsSearchParams }) {
  const params = searchParams ? await searchParams : {}
  const runId = firstParam(params.runId, '')
  const run = runId ? await getMpsoRun(runId) : null

  if (!run || run.status !== 'completed' || !run.samples.length) {
    redirect('/contact')
  }

  const protocolKey = protocolKeyFromLabel(run.protocol)
  const benchmarkMetadata = buildBenchmarkView(protocolKey, run.parties, run.dataset)
  const baselineStatusByPower = new Map(
    benchmarkMetadata.allRows.map((row) => [row.power, row.baselineStatus]),
  )
  const rows = run.samples.map((sample) => liveBenchmarkRow(
    sample,
    baselineStatusByPower.get(sample.datasetPower) ?? (sample.sotaOnlineMs === null ? 'missing' : 'available'),
  ))
  const timeSummary = valueSummary(rows.map((row) => row.oursTime), formatSeconds)
  const commSummary = valueSummary(rows.map((row) => row.oursComm), formatMiB)
  const hasComparison = rows.some((row) => row.timeRatio || row.commRatio)
  const hasOom = rows.some((row) => row.baselineStatus === 'oom')
  const hasUnpublishedImplementation = rows.some((row) => row.baselineStatus === 'unpublished')
  const comparisonSummary = run.parties === 2
    ? 'N/A'
    : hasOom
      ? 'SOTA 运行失败（超出内存极限）'
      : hasComparison
        ? valueSummary(rows.map((row) => row.timeRatio), (value) => formatRatio(value, '更快', '更慢'))
        : hasUnpublishedImplementation
          ? 'SOTA 未公开实现'
          : 'SOTA 数据缺失'
  const partyNote = `${run.parties} 方真实运行`
  const datasetNote = run.dataset === 'all'
    ? `${rows.length} 组规模真实运行`
    : `${formatDatasetLabel(run.dataset)} · 真实运行`
  const output = liveOutput(run.protocol, run.samples, run.parties)
  const partyLabel = `${run.parties} 方`
  const runLabel = `${run.protocol} · ${partyLabel} · ${formatDatasetLabel(run.dataset)}`
  const advantage = hasOom ? null : bestAdvantage(rows)
  const advantageLabel = advantage
    ? advantage.metric === 'time'
      ? `${advantage.ratio.toFixed(2)}x 更快`
      : `${advantage.ratio.toFixed(2)}x 更低`
    : comparisonSummary
  const summaryItems = [
    {
      icon: Table2,
      label: '计算结果',
      value: output.primary,
      detail: output.subtitle,
    },
    {
      icon: Clock,
      label: '在线耗时',
      value: timeSummary,
      detail: partyNote,
    },
    {
      icon: Radio,
      label: '通信量',
      value: commSummary,
      detail: datasetNote,
    },
    {
      icon: Gauge,
      label: '性能对照',
      value: advantageLabel,
      detail: hasComparison && !hasOom ? benchmarkMetadata.references[0] ?? '公开基准数据' : '',
    },
  ]

  return (
    <main className="bg-background text-foreground overflow-hidden">
      <section className="bg-background pb-20 pt-24 lg:pb-20 lg:pt-28">
        <div className="site-shell max-w-[2400px]">
          <div className="overflow-hidden rounded-lg border border-primary/35 bg-card p-5 md:p-8 lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
            <div className="space-y-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="mb-2 text-2xl font-bold text-foreground md:text-3xl 2xl:text-4xl">本次任务</h2>
                  <p className="text-lg text-muted-foreground 2xl:text-xl">当前任务：{runLabel}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 rounded-full border border-emerald-800 bg-emerald-950/40 px-4 py-2 text-base font-medium text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    运行成功
                  </div>
                  <Button asChild variant="outline" className="h-11 rounded-full border-border bg-card px-5 text-base text-foreground hover:bg-muted">
                    <Link href="/contact" className="inline-flex items-center gap-2">
                      <RotateCcw className="w-4 h-4" />
                      重新开始
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4 2xl:gap-6">
                {summaryItems.map((item) => (
                  <div key={item.label} className="surface-card group rounded-lg border border-border bg-card p-6 2xl:p-8">
                    <div className="mb-4 flex items-center gap-2 text-lg text-muted-foreground">
                      <item.icon className="surface-card-icon size-5 text-primary" />
                      {item.label}
                    </div>
                    <p className="break-words text-2xl font-semibold text-foreground 2xl:text-3xl">{item.value}</p>
                    {item.detail ? <p className="mt-3 text-lg leading-8 text-muted-foreground 2xl:text-xl 2xl:leading-9">{item.detail}</p> : null}
                  </div>
                ))}
              </div>

              <section className="rounded-lg border border-border bg-card p-6 md:p-8 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="size-6 text-primary" />
                      <h3 className="text-2xl font-semibold text-foreground">在线运行数据</h3>
                    </div>
                    <p className="mt-2 text-lg text-muted-foreground">
                      {run.parties === 2 ? '本机真实运行结果；两方 SOTA 暂未接入' : '本机真实运行结果与既定 SOTA 基准对照'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-lg text-muted-foreground">
                    <span className="rounded border border-primary/20 bg-primary/10 px-3 py-1.5">{partyNote}</span>
                    <span className="rounded border border-primary/20 bg-primary/10 px-3 py-1.5">{datasetNote}</span>
                  </div>
                </div>

                {advantage ? (
                  <div className="mb-6 border-y border-border bg-secondary/70 px-6 py-7 2xl:px-8 2xl:py-9">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(320px,0.3fr)] lg:items-center">
                      <div>
                        <p className="text-lg text-muted-foreground">核心优势</p>
                        <p className="mt-2 text-3xl font-semibold text-foreground">
                          相较同规模 SOTA，{' '}
                          <span className="text-primary">{advantage.ratio.toFixed(2)}x</span>{' '}
                          {advantage.metric === 'time' ? '更快' : '通信量更低'}
                        </p>
                        <p className="mt-3 text-lg leading-8 text-muted-foreground">
                          {advantage.metric === 'time'
                            ? '对比同规模 SOTA，Ours 在在线阶段用更短时间完成协议计算。'
                            : '对比同规模 SOTA，Ours 在在线阶段使用更低通信开销完成协议计算。'}
                        </p>
                      </div>
                      <div className="px-1 py-2">
                        <div className="mb-3 flex items-center justify-between text-lg text-muted-foreground">
                          <span>Ours</span>
                          <span>SOTA</span>
                        </div>
                        <div className="relative h-5 overflow-hidden rounded-full bg-muted">
                          <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${Math.min(100, 100 / advantage.ratio)}%` }} />
                        </div>
                        <div className="mt-3 text-right text-lg text-primary">
                          {advantage.metric === 'time' ? '耗时' : '通信量'}约为 SOTA 的 {(100 / advantage.ratio).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mb-6 grid gap-5 lg:grid-cols-2">
                  <BenchmarkBars rows={rows} metric="time" title="在线耗时对比" />
                  <BenchmarkBars rows={rows} metric="comm" title="在线通信量对比" />
                </div>

                <div className="overflow-x-auto rounded-lg border border-primary/20">
                  <table className="min-w-[1120px] w-full text-left text-lg">
                    <thead className="bg-muted text-muted-foreground">
                      <tr>
                        <th className="px-4 py-4 font-medium">规模</th>
                        <th className="px-4 py-4 font-medium">数据量</th>
                        <th className="px-4 py-4 font-medium">Ours 耗时</th>
                        <th className="px-4 py-4 font-medium">SOTA 耗时</th>
                        <th className="px-4 py-4 font-medium">耗时对比</th>
                        <th className="px-4 py-4 font-medium">Ours 通信</th>
                        <th className="px-4 py-4 font-medium">SOTA 通信</th>
                        <th className="px-4 py-4 font-medium">通信对比</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-card">
                      {rows.map((row) => (
                        <tr key={row.setLabel}>
                          <td className="px-4 py-4 font-mono text-accent">{row.setLabel}</td>
                          <td className="px-4 py-4 font-mono text-foreground/80">{row.setSize.toLocaleString()}</td>
                          <td className="px-4 py-4 font-mono text-foreground">{formatSeconds(row.oursTime)}</td>
                          <td className="px-4 py-4 font-mono text-muted-foreground">{metricText(row.baselineTime, 'time', row.baselineStatus)}</td>
                          <td className="px-4 py-4 font-mono text-primary">{formatRatio(row.timeRatio, '更快', '更慢')}</td>
                          <td className="px-4 py-4 font-mono text-foreground">{formatMiB(row.oursComm)}</td>
                          <td className="px-4 py-4 font-mono text-muted-foreground">{metricText(row.baselineComm, 'comm', row.baselineStatus)}</td>
                          <td className="px-4 py-4 font-mono text-primary">{formatRatio(row.commRatio, '更低', '更高')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 text-lg leading-8 text-muted-foreground">
                  {run.parties === 2
                    ? 'Ours 耗时、通信量与运算结果来自 Taihang PSO 的本次真实运行；当前未接入两方 SOTA 对照。'
                    : 'Ours 耗时与运算结果来自本次真实运行；SOTA 耗时按既定倍率换算，通信量采用固定基准值。'}
                  {run.parties !== 2
                    ? '“数据缺失”表示当前参与方没有可用的公开基准；“未公开实现”表示公开资料未提供可复现代码；“OOM”表示 SOTA 在 64 GiB 测试条件下内存不足。'
                    : null}
                </p>
              </section>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
