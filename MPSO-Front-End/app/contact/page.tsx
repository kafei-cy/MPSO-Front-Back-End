'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, BarChart3, Cpu, Database, GitBranch, Loader2, Play, Target, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ProtocolTopology, {
  type ProtocolTopologyVariant,
  type ProtocolTrafficMode,
} from '@/components/protocol-topology'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import Footer from '@/components/sections/footer'

const protocolOptions = [
  '隐私集合求交集',
  '隐私集合求并集',
  '隐私集合求交集数量',
  '隐私集合求交集的和',
]

const partyCountOptions = ['2', '3', '4', '5', '6', '7', '8', '9', '10']
const datasetPowerOptions = ['all', '12', '14', '16', '18', '20']
const allDatasetPowers = [12, 14, 16, 18, 20]
const savedParamsKey = 'mpso:selected-run-params'

const runStages = [
  { icon: Users, label: '等待任务调度' },
  { icon: GitBranch, label: '生成离线材料' },
  { icon: Activity, label: '执行协议计算' },
  { icon: BarChart3, label: '汇总运行结果' },
]

type RunPhase = 'queued' | 'preparing' | 'running' | 'finalizing' | 'completed' | 'failed'

type RunStatusResponse = {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  phase: RunPhase
  error: string | null
  samples: Array<{
    preparationMs: number
    oursOnlineMs: number
  }>
}

type MachineInfo = {
  cpuModel: string
  logicalCores: number
  memoryTotalGiB: number
  memoryAvailableGiB: number
  testMemoryGiB: number
  system: string
  architecture: string
  observedAt: string
}

const phaseStageIndex: Record<Exclude<RunPhase, 'failed'>, number> = {
  queued: 0,
  preparing: 1,
  running: 2,
  finalizing: 3,
  completed: 3,
}

function formatDuration(milliseconds: number) {
  if (milliseconds < 1000) {
    return `${milliseconds.toFixed(1)} ms`
  }
  return `${(milliseconds / 1000).toFixed(3)} s`
}

function completedStageTimes(samples: RunStatusResponse['samples']) {
  const preparationMs = samples.reduce((total, sample) => total + sample.preparationMs, 0)
  const onlineMs = samples.reduce((total, sample) => total + sample.oursOnlineMs, 0)
  const suffix = samples.length > 1 ? '（累计）' : ''

  return [
    '已调度',
    `${formatDuration(preparationMs)}${suffix}`,
    `${formatDuration(onlineMs)}${suffix}`,
    '已汇总',
  ]
}

function expectedResult(protocol: string, parties: number, dataset: string) {
  const powers = dataset === 'all' ? allDatasetPowers : [Number(dataset)]
  const values = powers.map((power) => {
    const size = 2 ** power
    if (protocol === '隐私集合求并集') return size + parties - 1
    if (protocol === '隐私集合求交集的和') {
      const count = Math.max(0, size - parties + 1)
      return ((parties + size) * count) / 2
    }
    return Math.max(0, size - parties + 1)
  })
  const formatted = values.length === 1
    ? values[0].toLocaleString('zh-CN')
    : `${Math.min(...values).toLocaleString('zh-CN')} – ${Math.max(...values).toLocaleString('zh-CN')}`

  if (protocol === '隐私集合求并集') {
    return { label: '预期并集规模', value: `${formatted} 个元素` }
  }
  if (protocol === '隐私集合求交集数量') {
    return { label: '预期交集数量', value: `${formatted} 个` }
  }
  if (protocol === '隐私集合求交集的和') {
    return { label: '预期交集求和', value: formatted }
  }
  return { label: '预期交集规模', value: `${formatted} 个元素` }
}

const protocolDetails: Record<string, {
  variant: ProtocolTopologyVariant
  trafficMode: ProtocolTrafficMode
  alt: string
}> = {
  '隐私集合求交集': {
    variant: 'mpsi',
    trafficMode: 'mpsi',
    alt: '隐私集合求交集采用 P0 中心星型通信拓扑',
  },
  '隐私集合求并集': {
    variant: 'mpsu',
    trafficMode: 'mpsu',
    alt: '隐私集合求并集采用全连接 Mesh + P0 星型 + 链式 Shuffle 拓扑',
  },
  '隐私集合求交集数量': {
    variant: 'mpsic',
    trafficMode: 'mpsic',
    alt: '隐私集合求交集数量采用 P0 星型加链式 Shuffle 拓扑',
  },
  '隐私集合求交集的和': {
    variant: 'mpsic',
    trafficMode: 'mpsics',
    alt: '隐私集合求交集的和与交集数量共用 P0 星型加多方 Shuffle 拓扑',
  },
}

export default function Contact() {
  const router = useRouter()
  const requestControllerRef = useRef<AbortController | null>(null)
  const [protocolType, setProtocolType] = useState(protocolOptions[0])
  const [partyCount, setPartyCount] = useState('4')
  const [datasetPower, setDatasetPower] = useState('12')
  const [paramsReady, setParamsReady] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [completedRunId, setCompletedRunId] = useState<string | null>(null)
  const [machineInfo, setMachineInfo] = useState<MachineInfo | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [activeStage, setActiveStage] = useState<number | null>(null)
  const [stageTimes, setStageTimes] = useState<Array<string | null>>(runStages.map(() => null))

  const isAllDataset = datasetPower === 'all'
  const exponentValue = Number(datasetPower || 0)
  const datasetSize = 2 ** exponentValue
  const datasetSizeLabel = isAllDataset ? '全部' : Number.isFinite(datasetSize) ? datasetSize.toLocaleString() : '0'
  const protocolDiagram = protocolDetails[protocolType] ?? protocolDetails[protocolOptions[0]]
  const expected = expectedResult(protocolType, Number(partyCount), datasetPower)
  const datasetPowerText = isAllDataset ? '全部规模' : `2 的 ${datasetPower || 0} 次方`
  const datasetPowerOptionLabel = (power: string) => {
    if (power === 'all') {
      return '全部规模'
    }
    const size = 2 ** Number(power || 0)
    const sizeLabel = Number.isFinite(size) ? size.toLocaleString() : '0'
    return `2 的 ${power} 次方，${sizeLabel} 条`
  }
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(savedParamsKey)
      if (raw) {
        const saved = JSON.parse(raw) as Partial<{
          protocol: string
          protocolType: string
          parties: string
          partyCount: string
          dataset: string
          datasetPower: string
        }>
        const savedProtocol = saved.protocol ?? saved.protocolType
        const savedParties = saved.parties ?? saved.partyCount
        const savedDataset = saved.dataset ?? saved.datasetPower

        if (savedProtocol && protocolOptions.includes(savedProtocol)) {
          setProtocolType(savedProtocol)
        }
        if (savedParties && partyCountOptions.includes(savedParties)) {
          setPartyCount(savedParties)
        }
        if (savedDataset && datasetPowerOptions.includes(savedDataset)) {
          setDatasetPower(savedDataset)
        }
      }
    } catch {
      window.localStorage.removeItem(savedParamsKey)
    } finally {
      setParamsReady(true)
    }
  }, [])

  useEffect(() => {
    if (!paramsReady) return
    window.localStorage.setItem(savedParamsKey, JSON.stringify({
      protocol: protocolType,
      parties: partyCount,
      dataset: datasetPower,
    }))
  }, [datasetPower, paramsReady, partyCount, protocolType])

  useEffect(() => {
    const controller = new AbortController()
    const loadMachineInfo = async () => {
      try {
        const response = await fetch('/api/health', { cache: 'no-store', signal: controller.signal })
        if (!response.ok) return
        const health = await response.json() as { machine?: MachineInfo }
        if (health.machine) setMachineInfo(health.machine)
      } catch {
        // The component may unmount while the request is in flight.
      }
    }
    void loadMachineInfo()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    return () => {
      requestControllerRef.current?.abort()
    }
  }, [])

  const buildResultHref = (runId: string) => `/results?runId=${encodeURIComponent(runId)}`

  const handleCreateTask = async () => {
    if (isRunning) return

    window.localStorage.setItem(savedParamsKey, JSON.stringify({
      protocol: protocolType,
      parties: partyCount,
      dataset: datasetPower,
    }))

    requestControllerRef.current?.abort()
    const controller = new AbortController()
    requestControllerRef.current = controller
    setIsRunning(true)
    setCompletedRunId(null)
    setRunError(null)
    setActiveStage(0)
    setStageTimes(runStages.map(() => null))

    try {
      const createResponse = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocol: protocolType,
          parties: Number(partyCount),
          dataset: datasetPower,
          threads: 4,
        }),
        signal: controller.signal,
      })
      const created = await createResponse.json() as { id?: string; error?: string }
      if (!createResponse.ok || !created.id) {
        throw new Error(created.error ?? '无法创建运行任务')
      }

      window.sessionStorage.setItem('mpso:last-run-id', created.id)
      while (!controller.signal.aborted) {
        const statusResponse = await fetch(`/api/runs/${created.id}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const run = await statusResponse.json() as RunStatusResponse & { error?: string }
        if (!statusResponse.ok) {
          throw new Error(run.error ?? '无法读取运行状态')
        }
        if (run.status === 'failed' || run.phase === 'failed') {
          throw new Error(run.error ?? '协议运行失败')
        }

        const stageIndex = phaseStageIndex[run.phase as Exclude<RunPhase, 'failed'>]
        if (run.status === 'completed') {
          setStageTimes(completedStageTimes(run.samples))
          setActiveStage(null)
          setIsRunning(false)
          setCompletedRunId(created.id)
          requestControllerRef.current = null
          return
        }

        setActiveStage(stageIndex)
        setStageTimes(runStages.map((_, index) => (index < stageIndex ? '已完成' : null)))
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    } catch (error) {
      if (controller.signal.aborted) return
      setRunError(error instanceof Error ? error.message : '协议运行失败')
      setIsRunning(false)
      setActiveStage(null)
    }
  }

  const handlePrimaryAction = () => {
    if (completedRunId) {
      router.push(buildResultHref(completedRunId))
      return
    }
    void handleCreateTask()
  }

  return (
    <main className="bg-background text-foreground overflow-hidden">
      <section className="bg-background pb-20 pt-24 lg:pb-20 lg:pt-28">
        <div className="site-shell max-w-[2400px]">
          <div className="relative overflow-hidden rounded-lg border border-primary/35 bg-card p-0 lg:border-primary/45 lg:p-8 2xl:p-10">
            <div className="space-y-8 p-5 md:p-8 lg:p-0">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="mb-2 text-2xl font-bold text-foreground md:text-3xl 2xl:text-4xl">多方隐私集合运算运行台</h2>
                  <p className="text-lg text-muted-foreground 2xl:text-xl">当前任务：{protocolType}</p>
                </div>
                <div className="flex items-center gap-3 text-base font-medium text-muted-foreground 2xl:text-lg">
                  <div className={`size-2.5 rounded-full ${isRunning ? 'bg-primary animate-pulse' : completedRunId ? 'bg-emerald-400' : 'bg-muted-foreground/50'}`}></div>
                  {isRunning ? '运行中' : completedRunId ? '已完成' : '待创建'}
                </div>
              </div>

              <div className={`mt-8 grid gap-5 md:grid-cols-3 lg:gap-6 ${isRunning ? 'opacity-75' : ''}`}>
                <div className="surface-card group min-w-0 rounded-lg border border-border bg-background/55 p-5 lg:rounded-xl lg:border-2 lg:border-primary/30 lg:bg-card/50 lg:p-6">
                  <div className="mb-5 flex size-12 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-background">
                    <GitBranch className="size-6" />
                  </div>
                  <label className="mb-3 block text-lg font-bold text-foreground 2xl:text-xl">协议类型</label>
                  <Select value={protocolType} onValueChange={setProtocolType} disabled={isRunning || Boolean(completedRunId)}>
                    <SelectTrigger className="h-14 w-full border-2 border-primary/35 bg-background/70 px-4 text-lg font-semibold text-primary hover:border-accent/70 focus-visible:border-primary 2xl:h-16 2xl:text-xl">
                      <span className="truncate">{protocolType}</span>
                    </SelectTrigger>
                    <SelectContent className="w-[var(--radix-select-trigger-width)] border-primary/30">
                      {protocolOptions.map((option) => (
                        <SelectItem key={option} value={option} className="py-3 text-base data-[state=checked]:bg-primary/15 data-[state=checked]:text-primary 2xl:text-lg">
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-4 text-base leading-7 text-muted-foreground 2xl:text-lg 2xl:leading-8">支持求交、求并、数量统计和数据求和。</p>
                </div>
                <div className="surface-card group min-w-0 rounded-lg border border-border bg-background/55 p-5 lg:rounded-xl lg:border-2 lg:border-primary/30 lg:bg-card/50 lg:p-6">
                  <div className="mb-5 flex size-12 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-background">
                    <Users className="size-6" />
                  </div>
                  <label className="mb-3 block text-lg font-bold text-foreground 2xl:text-xl">参与方数量</label>
                  <Select value={partyCount} onValueChange={setPartyCount} disabled={isRunning || Boolean(completedRunId)}>
                    <SelectTrigger className="h-14 w-full border-2 border-primary/35 bg-background/70 px-4 text-lg font-semibold text-accent hover:border-accent/70 focus-visible:border-accent 2xl:h-16 2xl:text-xl">
                      <span className="truncate">{partyCount} 方</span>
                    </SelectTrigger>
                    <SelectContent className="w-[var(--radix-select-trigger-width)] border-accent/30">
                      {partyCountOptions.map((count) => (
                        <SelectItem key={count} value={count} className="py-3 text-base data-[state=checked]:bg-accent/15 data-[state=checked]:text-accent 2xl:text-lg">
                          {count} 方
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-4 text-base leading-7 text-muted-foreground 2xl:text-lg 2xl:leading-8">支持 2 到 10 方共同参与一次运算。</p>
                </div>
                <div className="surface-card group min-w-0 rounded-lg border border-border bg-background/55 p-5 lg:rounded-xl lg:border-2 lg:border-primary/30 lg:bg-card/50 lg:p-6">
                  <div className="mb-5 flex size-12 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-background">
                    <Database className="size-6" />
                  </div>
                  <label className="mb-3 block text-lg font-bold text-foreground 2xl:text-xl">数据集规模</label>
                  <Select value={datasetPower} onValueChange={setDatasetPower} disabled={isRunning || Boolean(completedRunId)}>
                    <SelectTrigger className="h-14 w-full border-2 border-primary/35 bg-background/70 px-4 text-lg font-semibold text-primary hover:border-accent/70 focus-visible:border-primary 2xl:h-16 2xl:text-xl">
                      <span className="truncate">{datasetPowerOptionLabel(datasetPower)}</span>
                    </SelectTrigger>
                    <SelectContent className="w-[var(--radix-select-trigger-width)] border-primary/30">
                      {datasetPowerOptions.map((power) => (
                        <SelectItem key={power} value={power} className="py-3 text-base data-[state=checked]:bg-primary/15 data-[state=checked]:text-primary 2xl:text-lg">
                          {datasetPowerOptionLabel(power)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-4 text-base leading-7 text-muted-foreground 2xl:text-lg 2xl:leading-8">
                    {isAllDataset ? '运行全部可用数据规模。' : `当前规模：${datasetPowerText}，共 ${datasetSizeLabel} 条。`}
                  </p>
                </div>
              </div>

              <div className="grid items-stretch gap-6 lg:grid-cols-3">
                <div className="overflow-hidden rounded-lg border border-border bg-card p-2 sm:p-3 lg:col-span-2 lg:p-4">
                  <div className="relative aspect-video w-full overflow-hidden bg-card">
                    <ProtocolTopology
                      key={`${protocolDiagram.variant}-${protocolDiagram.trafficMode}`}
                      variant={protocolDiagram.variant}
                      trafficMode={protocolDiagram.trafficMode}
                      aria-label={protocolDiagram.alt}
                      className="h-full w-full"
                    />
                  </div>
                </div>

                <div className="flex min-h-0 flex-col gap-4">
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card p-4">
                    <p className="text-2xl font-bold text-foreground">运行流程</p>
                    <div className="mt-3 flex flex-1 flex-col gap-2">
                      {runStages.map((item, index) => {
                      const state =
                        activeStage === null
                          ? stageTimes[index]
                            ? 'done'
                            : 'pending'
                          : index < activeStage
                            ? 'done'
                            : index === activeStage
                              ? 'active'
                              : 'pending'
                      const timeLabel = stageTimes[index] ?? (state === 'active' ? '进行中' : '未开始')

                        return (
                          <div
                            key={index}
                            className={`flex flex-1 items-center gap-4 rounded-lg border px-4 py-2.5 text-lg transition-colors ${
                              state === 'active'
                                ? 'border-primary/70 bg-primary/15 text-foreground shadow-[0_0_0_1px_rgba(0,240,138,0.14)]'
                                : state === 'done'
                                  ? 'border-emerald-400/35 bg-emerald-400/10 text-foreground'
                                  : 'border-border bg-background/30 text-foreground/80'
                            }`}
                          >
                            <item.icon className={`size-5 shrink-0 ${state === 'done' ? 'text-emerald-400' : state === 'active' ? 'text-primary' : 'text-muted-foreground'} ${state === 'active' ? 'animate-pulse' : ''}`} />
                            <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                              <span className="truncate">{item.label}</span>
                              <span className="shrink-0 font-mono text-sm text-muted-foreground 2xl:text-base">{timeLabel}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <p className="mt-3 border-t border-border pt-3 text-base leading-7 text-muted-foreground">
                      通信拓扑以四方为例，动态显示各阶段的数据流向。
                    </p>
                  </div>

                  <div className="shrink-0 rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Target className="size-5 text-primary" />
                        <p className="text-lg font-bold text-foreground 2xl:text-xl">预期结果与测试机配置</p>
                      </div>
                      <span className="shrink-0 text-xs text-emerald-400">
                        {machineInfo
                          ? `读取于 ${new Date(machineInfo.observedAt).toLocaleTimeString('zh-CN', { hour12: false })}`
                          : '正在读取'}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-4 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">{expected.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {isAllDataset ? '全部规模预期范围' : '按内置测试集合计算'}
                        </p>
                      </div>
                      <p className="max-w-[62%] break-words text-right text-lg font-bold text-primary 2xl:text-xl">{expected.value}</p>
                    </div>

                    <dl className="mt-1 divide-y divide-border text-sm">
                      <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3 py-1.5">
                        <dt className="text-muted-foreground">处理器</dt>
                        <dd className="min-w-0 break-words text-right text-foreground">
                          {machineInfo ? `${machineInfo.cpuModel} · ${machineInfo.logicalCores} 逻辑线程` : '正在读取'}
                        </dd>
                      </div>
                      <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3 py-1.5">
                        <dt className="flex items-center gap-1.5 text-muted-foreground"><Cpu className="size-4 text-accent" />内存</dt>
                        <dd className="text-right text-foreground">
                          {machineInfo ? `${machineInfo.memoryTotalGiB} GiB 总计 · 测试可用 ${machineInfo.testMemoryGiB} GiB` : '正在读取'}
                        </dd>
                      </div>
                      <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3 pt-1.5">
                        <dt className="text-muted-foreground">系统</dt>
                        <dd className="min-w-0 break-words text-right text-foreground">
                          {machineInfo ? `${machineInfo.system} · ${machineInfo.architecture}` : '正在读取'}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>

              {runError ? (
                <div role="alert" className="rounded-lg border border-red-400/35 bg-red-950/25 px-5 py-4 text-base text-red-300 2xl:text-lg">
                  运行失败：{runError}
                </div>
              ) : null}

              <Button
                type="button"
                onClick={handlePrimaryAction}
                disabled={!paramsReady || isRunning}
                className="h-14 w-full rounded-full bg-primary text-lg font-bold text-primary-foreground transition-colors hover:bg-accent hover:text-background disabled:opacity-60 lg:h-16 lg:text-xl"
              >
                {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : completedRunId ? <BarChart3 className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isRunning ? '正在运行真实任务' : completedRunId ? '查看结果' : '开始运行'}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
