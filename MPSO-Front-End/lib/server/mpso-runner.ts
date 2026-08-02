import 'server-only'

import { access, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import {
  buildBenchmarkView,
  protocolKeyFromLabel,
} from '@/lib/mpso-results'
import {
  completeMpsoRun,
  failMpsoRun,
  getMpsoRun,
  insertMpsoRunSample,
  markMpsoRunStarted,
  updateMpsoRunPhase,
} from '@/lib/server/mpso-database'
import { parseOnlineCommunicationMiB } from '@/lib/server/mpso-metrics'

const protocolExecutables: Record<string, string> = {
  '隐私集合求交集': 'test_mpsi',
  '隐私集合求并集': 'test_mpsu',
  '隐私集合求交集数量': 'test_mpsic',
  '隐私集合求交集的和': 'test_mpsics',
}

const taihangModes: Record<string, string> = {
  '隐私集合求交集': 'psi',
  '隐私集合求并集': 'psu',
  '隐私集合求交集数量': 'psic',
  '隐私集合求交集的和': 'psics',
}

const allDatasetPowers = [12, 14, 16, 18, 20]
const resultMarker = 'MPSO_RESULT_JSON '
const maxLogLength = 200_000

type PartyOutput = {
  role: number
  stdout: string
  stderr: string
}

type NativeResult = {
  success: boolean
  protocol: string
  parties: number
  datasetPower: number
  setSize: number
  resultType: string
  resultCount?: number
  expectedCount?: number
  resultSum?: number
  expectedSum?: number
  onlineMs: number
}

type TaihangResult = NativeResult & {
  preparationMs: number
  communicationMiB: number
}

type QueueState = {
  tail: Promise<void>
}

const globalForRunner = globalThis as unknown as {
  mpsoQueueState?: QueueState
}

function queueState() {
  if (!globalForRunner.mpsoQueueState) {
    globalForRunner.mpsoQueueState = { tail: Promise.resolve() }
  }
  return globalForRunner.mpsoQueueState
}

export function mpsoBuildDirectory() {
  return process.env.MPSO_BUILD_DIR
    ? path.resolve(process.env.MPSO_BUILD_DIR)
    : path.resolve(process.cwd(), '../MPSO/build')
}

export function taihangPsoExecutable() {
  return process.env.TAIHANG_PSO_ADAPTER
    ? path.resolve(process.env.TAIHANG_PSO_ADAPTER)
    : path.resolve(process.cwd(), '../Taihang/adapter/build/taihang_pso_adapter')
}

function jobTimeoutMs() {
  const configured = Number(process.env.MPSO_JOB_TIMEOUT_MS ?? 30 * 60 * 1000)
  return Number.isFinite(configured) && configured >= 10_000 ? configured : 30 * 60 * 1000
}

function appendLimited(previous: string, chunk: Buffer | string) {
  if (previous.length >= maxLogLength) return previous
  return (previous + chunk.toString()).slice(0, maxLogLength)
}

async function runPartyGroup(input: {
  executable: string
  parties: number
  power: number
  threads: number
  preGenerate: boolean
}): Promise<PartyOutput[]> {
  const buildDirectory = mpsoBuildDirectory()
  const executablePath = path.join(buildDirectory, input.executable)
  await access(executablePath)
  await mkdir(path.join(buildDirectory, 'offline'), { recursive: true })

  return new Promise((resolve, reject) => {
    const children: ChildProcess[] = []
    const outputs: PartyOutput[] = Array.from({ length: input.parties }, (_, role) => ({
      role,
      stdout: '',
      stderr: '',
    }))
    let closed = 0
    let settled = false

    const stopAll = () => {
      for (const child of children) {
        if (!child.killed) child.kill('SIGTERM')
      }
    }

    const fail = (error: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      stopAll()
      reject(error)
    }

    const timeout = setTimeout(() => {
      fail(new Error(`MPSO 任务超过 ${Math.round(jobTimeoutMs() / 1000)} 秒，已终止`))
    }, jobTimeoutMs())

    for (let role = 0; role < input.parties; role += 1) {
      const args = [
        '-k', String(input.parties),
        '-nn', String(input.power),
        '-nt', String(input.threads),
        '-r', String(role),
      ]
      if (input.preGenerate) args.unshift('-preGen')

      const child = spawn(executablePath, args, {
        cwd: buildDirectory,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      children.push(child)
      child.stdout.on('data', (chunk: Buffer) => {
        outputs[role].stdout = appendLimited(outputs[role].stdout, chunk)
      })
      child.stderr.on('data', (chunk: Buffer) => {
        outputs[role].stderr = appendLimited(outputs[role].stderr, chunk)
      })
      child.on('error', (error) => {
        fail(new Error(`无法启动 ${input.executable} 的 P${role}: ${error.message}`))
      })
      child.on('close', (code, signal) => {
        if (settled) return
        if (code !== 0) {
          const details = outputs[role].stderr || outputs[role].stdout
          fail(new Error(`${input.executable} 的 P${role} 异常退出（${code ?? signal}）：${details.slice(-2000)}`))
          return
        }
        closed += 1
        if (closed === input.parties) {
          settled = true
          clearTimeout(timeout)
          resolve(outputs)
        }
      })
    }
  })
}

async function runTaihangProcess(input: {
  mode: string
  power: number
  threads: number
}): Promise<PartyOutput[]> {
  const executablePath = taihangPsoExecutable()
  await access(executablePath)
  const port = 19000 + ((process.pid + input.power * 97) % 1000)

  return new Promise((resolve, reject) => {
    const output: PartyOutput = { role: 0, stdout: '', stderr: '' }
    let settled = false
    const child = spawn(executablePath, [
      '--mode', input.mode,
      '--power', String(input.power),
      '--threads', String(input.threads),
      '--port', String(port),
    ], {
      cwd: path.dirname(executablePath),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGTERM')
      reject(new Error(`Taihang PSO 任务超过 ${Math.round(jobTimeoutMs() / 1000)} 秒，已终止`))
    }, jobTimeoutMs())

    child.stdout.on('data', (chunk: Buffer) => {
      output.stdout = appendLimited(output.stdout, chunk)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      output.stderr = appendLimited(output.stderr, chunk)
    })
    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(new Error(`无法启动 Taihang PSO 适配器：${error.message}`))
    })
    child.on('close', (code, signal) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (code !== 0) {
        const details = output.stderr || output.stdout
        reject(new Error(`Taihang PSO 适配器异常退出（${code ?? signal}）：${details.slice(-2000)}`))
        return
      }
      resolve([output])
    })
  })
}

function parseNativeResult(outputs: PartyOutput[]) {
  for (const output of outputs) {
    for (const line of output.stdout.split(/\r?\n/)) {
      if (!line.startsWith(resultMarker)) continue
      const parsed = JSON.parse(line.slice(resultMarker.length)) as NativeResult
      if (!parsed.success) {
        throw new Error(`${parsed.protocol} 返回了错误结果`)
      }
      if (!Number.isFinite(parsed.onlineMs) || parsed.onlineMs <= 0) {
        throw new Error(`${parsed.protocol} 没有返回有效的在线耗时`)
      }
      return parsed
    }
  }
  throw new Error('MPSO 没有返回机器可读的结果，请检查 C++ 可执行程序是否为最新版本')
}

function parseTaihangResult(outputs: PartyOutput[]) {
  for (const output of outputs) {
    for (const line of output.stdout.split(/\r?\n/)) {
      if (!line.startsWith('TAIHANG_RESULT_JSON ')) continue
      const parsed = JSON.parse(line.slice('TAIHANG_RESULT_JSON '.length)) as TaihangResult
      if (!parsed.success) {
        throw new Error(`${parsed.protocol} 返回了错误结果`)
      }
      if (!Number.isFinite(parsed.onlineMs) || parsed.onlineMs <= 0) {
        throw new Error(`${parsed.protocol} 没有返回有效的在线耗时`)
      }
      if (!Number.isFinite(parsed.preparationMs) || parsed.preparationMs < 0) {
        throw new Error(`${parsed.protocol} 没有返回有效的离线耗时`)
      }
      if (!Number.isFinite(parsed.communicationMiB) || parsed.communicationMiB <= 0) {
        throw new Error(`${parsed.protocol} 没有返回有效的在线通信量`)
      }
      return parsed
    }
  }
  throw new Error('Taihang PSO 没有返回机器可读的结果，请检查适配器是否为最新版本')
}

function resultValue(nativeResult: NativeResult): Record<string, number | string | boolean> {
  if (nativeResult.resultType === 'intersection-sum') {
    return {
      sum: nativeResult.resultSum ?? 0,
      expected: nativeResult.expectedSum ?? 0,
      verified: nativeResult.resultSum === nativeResult.expectedSum,
    }
  }
  return {
    count: nativeResult.resultCount ?? 0,
    expected: nativeResult.expectedCount ?? 0,
    verified: nativeResult.resultCount === nativeResult.expectedCount,
  }
}

function combinedLog(prepareOutputs: PartyOutput[], onlineOutputs: PartyOutput[]) {
  const sections: string[] = []
  for (const [label, outputs] of [['PREPARE', prepareOutputs], ['ONLINE', onlineOutputs]] as const) {
    for (const output of outputs) {
      const content = `${output.stdout}${output.stderr ? `\nSTDERR:\n${output.stderr}` : ''}`.trim()
      if (content) sections.push(`[${label} P${output.role}]\n${content}`)
    }
  }
  return sections.join('\n\n').slice(0, maxLogLength)
}

async function executeMpsoRun(runId: string) {
  const run = await getMpsoRun(runId)
  if (!run || run.status !== 'queued') return

  const executable = protocolExecutables[run.protocol]
  if (!executable) {
    await failMpsoRun(runId, `不支持的协议：${run.protocol}`)
    return
  }

  const powers = run.dataset === 'all' ? allDatasetPowers : [Number(run.dataset)]
  if (powers.some((power) => !allDatasetPowers.includes(power))) {
    await failMpsoRun(runId, `不支持的数据规模：${run.dataset}`)
    return
  }

  try {
    await markMpsoRunStarted(runId)
    for (const power of powers) {
      if (run.parties === 2) {
        const taihangMode = taihangModes[run.protocol]
        if (!taihangMode) {
          await failMpsoRun(runId, `不支持的 Taihang 协议：${run.protocol}`)
          return
        }

        // Taihang PSO has no reusable offline phase; the run is online-only.
        await updateMpsoRunPhase(runId, 'running', power)
        const taihangOutputs = await runTaihangProcess({
          mode: taihangMode,
          power,
          threads: run.threads,
        })
        const taihangResult = parseTaihangResult(taihangOutputs)

        await updateMpsoRunPhase(runId, 'finalizing', power)
        await insertMpsoRunSample({
          runId,
          datasetPower: power,
          setSize: taihangResult.setSize,
          resultType: taihangResult.resultType,
          resultValue: resultValue(taihangResult),
          oursOnlineMs: taihangResult.onlineMs,
          sotaMultiplier: null,
          sotaOnlineMs: null,
          oursCommMiB: taihangResult.communicationMiB,
          sotaCommMiB: null,
          benchmarkParties: null,
          benchmarkPower: null,
          preparationMs: taihangResult.preparationMs,
          rawLog: combinedLog([], taihangOutputs),
        })
        continue
      }

      await updateMpsoRunPhase(runId, 'preparing', power)
      const preparationStartedAt = performance.now()
      const prepareOutputs = await runPartyGroup({
        executable,
        parties: run.parties,
        power,
        threads: run.threads,
        preGenerate: true,
      })
      const preparationMs = performance.now() - preparationStartedAt

      await updateMpsoRunPhase(runId, 'running', power)
      const onlineOutputs = await runPartyGroup({
        executable,
        parties: run.parties,
        power,
        threads: run.threads,
        preGenerate: false,
      })
      const nativeResult = parseNativeResult(onlineOutputs)
      const measuredOnlineCommMiB = parseOnlineCommunicationMiB(
        onlineOutputs.find((output) => output.role === 0)?.stdout ?? '',
      )

      const benchmark = buildBenchmarkView(
        protocolKeyFromLabel(run.protocol),
        run.parties,
        String(power),
      )
      const benchmarkRow = benchmark.rows[0] ?? null
      const multiplier = benchmarkRow?.timeRatio ?? null
      const sotaOnlineMs = multiplier ? nativeResult.onlineMs * multiplier : null
      const oursCommMiB = benchmarkRow?.oursComm ?? measuredOnlineCommMiB
      if (oursCommMiB === null) {
        throw new Error(`${nativeResult.protocol} 没有返回有效的在线通信量`)
      }

      await updateMpsoRunPhase(runId, 'finalizing', power)
      await insertMpsoRunSample({
        runId,
        datasetPower: power,
        setSize: nativeResult.setSize,
        resultType: nativeResult.resultType,
        resultValue: resultValue(nativeResult),
        oursOnlineMs: nativeResult.onlineMs,
        sotaMultiplier: multiplier,
        sotaOnlineMs,
        oursCommMiB,
        sotaCommMiB: benchmarkRow?.baselineComm ?? null,
        benchmarkParties: benchmark.selectedParties,
        benchmarkPower: benchmarkRow?.power ?? benchmark.selectedPower,
        preparationMs,
        rawLog: combinedLog(prepareOutputs, onlineOutputs),
      })
    }
    await completeMpsoRun(runId)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MPSO 运行失败'
    await failMpsoRun(runId, message)
  }
}

export function enqueueMpsoRun(runId: string) {
  const state = queueState()
  state.tail = state.tail
    .catch(() => undefined)
    .then(() => executeMpsoRun(runId))
    .catch((error) => {
      console.error('MPSO queue error', error)
    })
}

export async function checkMpsoExecutables() {
  const directory = mpsoBuildDirectory()
  await Promise.all(Object.values(protocolExecutables).map((name) => access(path.join(directory, name))))
  await access(taihangPsoExecutable())
  return directory
}
