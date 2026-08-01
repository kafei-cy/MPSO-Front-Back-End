export type ProtocolKey = 'MPSI' | 'MPSI-card' | 'MPSI-card-sum' | 'MPSU'
type SeriesKind = 'ours' | 'baseline'
export type BaselineStatus = 'available' | 'missing' | 'unpublished' | 'oom'

type BenchmarkSeries = {
  name: string
  kind: SeriesKind
  time: Array<number | null>
  comm: Array<number | null>
}

type ProtocolBenchmark = {
  protocol: ProtocolKey
  note: string
  references: string[]
  parties: Record<number, BenchmarkSeries[]>
  exactPartiesOnly?: boolean
  baselineOomPowers?: Partial<Record<number, number[]>>
  baselineUnpublishedParties?: number[]
  defaultUnavailableStatus?: Exclude<BaselineStatus, 'available'>
}

export type BenchmarkRow = {
  power: number
  setSize: number
  setLabel: string
  oursTime: number | null
  baselineTime: number | null
  timeRatio: number | null
  oursComm: number | null
  baselineComm: number | null
  commRatio: number | null
  baselineStatus: BaselineStatus
}

export type ResultDetailRow = {
  label: string
  value: string
}

const setPowers = [12, 14, 16, 18, 20]
const setSizes = setPowers.map((power) => 2 ** power)

const protocolMap: Record<string, ProtocolKey> = {
  '隐私集合求交集': 'MPSI',
  '隐私集合求并集': 'MPSU',
  '隐私集合求交集数量': 'MPSI-card',
  '隐私集合求交集的和': 'MPSI-card-sum',
}

const resultTypeLabels: Record<ProtocolKey, string> = {
  MPSI: '交集指纹低 64 位',
  MPSU: '并集指纹低 64 位',
  'MPSI-card': '交集数量',
  'MPSI-card-sum': '交集指纹和',
}

function series(name: string, kind: SeriesKind, time: Array<number | null>, comm: Array<number | null>): BenchmarkSeries {
  return { name, kind, time, comm }
}

const benchmarkData: Record<ProtocolKey, ProtocolBenchmark> = {
  MPSI: {
    protocol: 'MPSI',
    note: '局域网环境下的在线耗时与通信量对照。',
    references: ['Wu, Yuen, and Chan. O-Ring and K-Star. USENIX Security 2024.'],
    exactPartiesOnly: true,
    parties: {
      3: [
        series('SOTA', 'baseline', [0.48, 0.168, 0.822, 4.227, 19.18], [0.423, 1.681, 6.344, 26.72, 110.0]),
        series('Ours', 'ours', [0.013, 0.047, 0.227, 1.533, 7.945], [0.641, 2.551, 10.2, 40.91, 164.2]),
      ],
      4: [
        series('SOTA', 'baseline', [0.054, 0.181, 0.854, 4.306, 20.09], [0.896, 3.557, 13.42, 56.11, 231.1]),
        series('Ours', 'ours', [0.015, 0.051, 0.242, 1.632, 8.133], [0.961, 3.826, 15.31, 61.36, 246.2]),
      ],
      5: [
        series('SOTA', 'baseline', [0.072, 0.201, 0.948, 4.611, 21.36], [1.542, 6.124, 23.1, 96.23, 396.3]),
        series('Ours', 'ours', [0.016, 0.053, 0.26, 1.724, 8.255], [1.282, 5.102, 20.41, 81.81, 328.3]),
      ],
      10: [
        series('SOTA', 'baseline', [0.136, 0.373, 1.479, 6.812, 30.89], [7.375, 29.3, 110.5, 456.9, 1883]),
        series('Ours', 'ours', [0.026, 0.075, 0.354, 1.91, 8.898], [2.884, 11.48, 45.92, 184.1, 738.7]),
      ],
    },
  },
  'MPSI-card': {
    protocol: 'MPSI-card',
    note: '局域网环境下的交集数量在线基准对照。',
    references: ['Chen, Ding, Gu, and Bian. Practical Multi-party Private Set Intersection Cardinality and Intersection-Sum Under Arbitrary Collusion. Inscrypt 2022.'],
    exactPartiesOnly: true,
    baselineUnpublishedParties: [3, 4, 5, 10],
    defaultUnavailableStatus: 'unpublished',
    parties: {
      3: [
        series('Ours', 'ours', [0.015, 0.052, 0.237, 1.581, 8.05], [0.761, 3.035, 12.15, 48.76, 195.8]),
      ],
      4: [
        series('Ours', 'ours', [0.016, 0.054, 0.252, 1.684, 8.3], [1.122, 4.472, 17.91, 71.83, 288.4]),
      ],
      5: [
        series('SOTA', 'baseline', [0.67, 1.789, 6.289, 31.24, null], [20.7, 94.49, 425.6, 1894, null]),
        series('Ours', 'ours', [0.018, 0.056, 0.27, 1.735, 8.616], [1.482, 5.909, 23.66, 94.9, 381.0]),
      ],
      10: [
        series('SOTA', 'baseline', [1.477, 4.503, 12.81, 95.23, null], [46.58, 212.6, 957.7, 4262, null]),
        series('Ours', 'ours', [0.026, 0.071, 0.375, 2.001, 9.226], [3.285, 13.09, 52.42, 210.2, 844.0]),
      ],
    },
  },
  'MPSI-card-sum': {
    protocol: 'MPSI-card-sum',
    note: '当前实现方案在局域网环境下的在线性能。',
    references: ['No prior implementation baseline is reported for MPSI-card-sum.'],
    exactPartiesOnly: true,
    parties: {
      3: [
        series('Ours', 'ours', [0.023, 0.088, 0.417, 2.81, 14.67], [1.283, 5.107, 20.43, 81.89, 328.6]),
      ],
      4: [
        series('Ours', 'ours', [0.025, 0.091, 0.436, 3.044, 15.16], [1.885, 7.499, 29.99, 120.2, 482.4]),
      ],
      5: [
        series('Ours', 'ours', [0.027, 0.094, 0.474, 3.15, 15.49], [2.486, 9.89, 39.56, 158.6, 636.2]),
      ],
      10: [
        series('Ours', 'ours', [0.039, 0.12, 0.632, 3.61, 16.65], [5.493, 21.85, 87.37, 350.2, 1405]),
      ],
    },
  },
  MPSU: {
    protocol: 'MPSU',
    note: '64 GiB 测试条件下，局域网环境中的集合求并在线基准对照。',
    references: ['Dong, Zhang, Bai, and Chen. Efficient Multi-Party Private Set Union Without Non-Collusion Assumptions. USENIX Security 2025.'],
    exactPartiesOnly: true,
    baselineOomPowers: { 10: [18, 20] },
    parties: {
      3: [
        series('SOTA', 'baseline', [0.017, 0.05, 0.215, 1.005, 4.352], [2.416, 9.702, 39.87, 161.2, 652.1]),
        series('Ours', 'ours', [0.022, 0.068, 0.298, 1.892, 9.607], [2.414, 9.695, 39.84, 161.1, 651.6]),
      ],
      4: [
        series('SOTA', 'baseline', [0.023, 0.071, 0.286, 1.393, 5.645], [5.653, 23.06, 93.06, 376.0, 1520]),
        series('Ours', 'ours', [0.029, 0.089, 0.415, 2.345, 11.25], [5.083, 20.77, 83.83, 338.9, 1370]),
      ],
      5: [
        series('SOTA', 'baseline', [0.03, 0.087, 0.368, 1.714, 7.003], [10.69, 43.52, 175.6, 709.1, 2865]),
        series('Ours', 'ours', [0.039, 0.114, 0.542, 2.796, 13.18], [8.739, 35.69, 144.0, 582.1, 2358]),
      ],
      10: [
        // 2^18 和 2^20 的 SOTA 单元格在原表中为“—”，表示 64 GiB 环境下 OOM，因此不生成倍率。
        series('SOTA', 'baseline', [0.088, 0.286, 1.183, null, null], [74.68, 300.2, 1210, null, null]),
        series('Ours', 'ours', [0.11, 0.337, 1.483, 7.167, null], [42.4, 170.2, 686.8, 2775, null]),
      ],
    },
  },
}

function nearestNumber(values: number[], target: number) {
  return values.reduce((best, next) => (Math.abs(next - target) < Math.abs(best - target) ? next : best), values[0])
}

function firstOurs(seriesList: BenchmarkSeries[]) {
  return seriesList.find((item) => item.kind === 'ours') ?? seriesList[0]
}

function bestBaselineValue(seriesList: BenchmarkSeries[], index: number, field: 'time' | 'comm') {
  const values = seriesList
    .filter((item) => item.kind === 'baseline')
    .map((item) => item[field][index])
    .filter((value): value is number => value !== null && value !== undefined)
  return values.length ? Math.min(...values) : null
}

function valueRange(values: Array<number | null>, formatter: (value: number) => string) {
  const available = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value))
  if (!available.length) return 'N/A'
  if (available.length === 1) return formatter(available[0])
  return `${formatter(Math.min(...available))} - ${formatter(Math.max(...available))}`
}

function rowFromSeries(seriesList: BenchmarkSeries[], index: number, unavailableStatus: Exclude<BaselineStatus, 'available'> = 'missing'): BenchmarkRow {
  const ours = firstOurs(seriesList)
  const oursTime = ours.time[index] ?? null
  const oursComm = ours.comm[index] ?? null
  const baselineTime = bestBaselineValue(seriesList, index, 'time')
  const baselineComm = bestBaselineValue(seriesList, index, 'comm')

  return {
    power: setPowers[index],
    setSize: setSizes[index],
    setLabel: `2^${setPowers[index]}`,
    oursTime,
    baselineTime,
    timeRatio: oursTime && baselineTime ? baselineTime / oursTime : null,
    oursComm,
    baselineComm,
    commRatio: oursComm && baselineComm ? baselineComm / oursComm : null,
    baselineStatus: baselineTime !== null || baselineComm !== null ? 'available' : unavailableStatus,
  }
}

function missingBenchmarkRow(index: number, baselineStatus: Exclude<BaselineStatus, 'available'> = 'missing'): BenchmarkRow {
  return {
    power: setPowers[index],
    setSize: setSizes[index],
    setLabel: `2^${setPowers[index]}`,
    oursTime: null,
    baselineTime: null,
    timeRatio: null,
    oursComm: null,
    baselineComm: null,
    commRatio: null,
    baselineStatus,
  }
}

export function protocolKeyFromLabel(label: string): ProtocolKey {
  return protocolMap[label] ?? 'MPSI'
}

export function formatDatasetLabel(power: string) {
  if (power === 'all') return '全部规模'
  const value = Number(power || 0)
  const size = 2 ** value
  return `2 的 ${power} 次方，${Number.isFinite(size) ? size.toLocaleString() : '0'} 条`
}

export function formatSeconds(value: number | null | undefined) {
  if (value === undefined || value === null) return 'N/A'
  return `${value.toFixed(value < 10 ? 3 : 2)} s`
}

export function formatMiB(value: number | null | undefined) {
  if (value === undefined || value === null) return 'N/A'
  return `${value.toFixed(value < 10 ? 3 : 1)} MB`
}

export function formatRatio(value: number | null | undefined, betterLabel: string, worseLabel: string) {
  if (!value || !Number.isFinite(value)) return 'N/A'
  if (value >= 1) return `${value.toFixed(2)}x ${betterLabel}`
  return `${(1 / value).toFixed(2)}x ${worseLabel}`
}

export function buildBenchmarkView(protocol: ProtocolKey, requestedParties: number, datasetPower: string) {
  const benchmark = benchmarkData[protocol]
  const availableParties = Object.keys(benchmark.parties).map(Number).sort((a, b) => a - b)
  const hasExactParties = Boolean(benchmark.parties[requestedParties])
  const selectedParties = hasExactParties
    ? requestedParties
    : benchmark.exactPartiesOnly
      ? null
      : nearestNumber(availableParties, requestedParties)
  const allRows = selectedParties === null
    ? setPowers.map((_, index) => missingBenchmarkRow(index, benchmark.defaultUnavailableStatus))
    : setPowers.map((power, index) => rowFromSeries(
        benchmark.parties[selectedParties],
        index,
        benchmark.baselineOomPowers?.[selectedParties]?.includes(power)
          ? 'oom'
          : benchmark.baselineUnpublishedParties?.includes(selectedParties)
            ? 'unpublished'
            : benchmark.defaultUnavailableStatus ?? 'missing',
      ))
  const requestedPower = Number(datasetPower)
  const hasExactDataset = datasetPower === 'all' || setPowers.includes(requestedPower)
  const selectedPower = datasetPower === 'all' ? null : hasExactDataset ? requestedPower : nearestNumber(setPowers, requestedPower)
  const rows = datasetPower === 'all' ? allRows : allRows.filter((row) => row.power === selectedPower)
  const partyNote = selectedParties === null
    ? `${requestedParties} 方 SOTA 数据缺失`
    : selectedParties === requestedParties
      ? `${selectedParties} 方基准数据`
      : `采用最接近的 ${selectedParties} 方基准数据`
  const datasetNote = datasetPower === 'all'
    ? '全部可用基准规模'
    : hasExactDataset
      ? `${formatDatasetLabel(datasetPower)} 基准数据`
      : `采用最接近的 2^${selectedPower} 基准数据`

  return {
    note: benchmark.note,
    references: benchmark.references,
    selectedParties,
    selectedPower,
    rows,
    allRows,
    partyNote,
    datasetNote,
    timeSummary: valueRange(rows.map((row) => row.oursTime), formatSeconds),
    commSummary: valueRange(rows.map((row) => row.oursComm), formatMiB),
    comparisonSummary: rows.some((row) => row.timeRatio || row.commRatio)
      ? valueRange(rows.map((row) => row.timeRatio), (value) => formatRatio(value, '更快', '更慢'))
      : '无 SOTA 对照',
  }
}

function setSizeFromPower(datasetPower: string) {
  if (datasetPower === 'all') return null
  const power = Number(datasetPower)
  if (!Number.isFinite(power)) return null
  return 2 ** power
}

function formatResultCount(value: number | string) {
  return typeof value === 'number' ? value.toLocaleString() : value
}

function rangeLabel(min: number, max: number) {
  return `${formatResultCount(min)} - ${formatResultCount(max)}`
}

function intersectionCount(setSize: number | null, parties: number) {
  if (setSize === null) {
    return rangeLabel(setSizes[0] - parties + 1, setSizes[setSizes.length - 1] - parties + 1)
  }
  return Math.max(0, setSize - parties + 1)
}

function unionElementCount(setSize: number | null, parties: number) {
  if (setSize === null) {
    return rangeLabel(setSizes[0] + parties - 1, setSizes[setSizes.length - 1] + parties - 1)
  }
  return setSize + parties - 1
}

function arithmeticSumLabel(setSize: number | null, parties: number) {
  const sumRange = (size: number) => {
    const first = BigInt(parties)
    const last = BigInt(size)
    const count = last - first + BigInt(1)
    return ((first + last) * count) / BigInt(2)
  }

  if (setSize === null) {
    return `${sumRange(setSizes[0]).toLocaleString()} - ${sumRange(setSizes[setSizes.length - 1]).toLocaleString()}`
  }
  return sumRange(setSize).toLocaleString()
}

export function buildProtocolOutput(protocol: ProtocolKey, parties: number, datasetPower: string) {
  const setSize = setSizeFromPower(datasetPower)
  const sharedCount = intersectionCount(setSize, parties)
  const unionCount = unionElementCount(setSize, parties)

  if (protocol === 'MPSU') {
    return {
      primary: `${formatResultCount(unionCount)} 个并集元素`,
      subtitle: '按多方集合合并去重计算',
      sample: [] as string[],
      rows: [
        { label: '输出类型', value: resultTypeLabels[protocol] },
        { label: '结果数量', value: formatResultCount(unionCount) },
        { label: '可见方', value: 'P0' },
      ],
    }
  }

  if (protocol === 'MPSI-card') {
    return {
      primary: formatResultCount(sharedCount),
      subtitle: '按多方共同元素数量计算',
      sample: [] as string[],
      rows: [
        { label: '输出类型', value: resultTypeLabels[protocol] },
        { label: '交集数量', value: formatResultCount(sharedCount) },
        { label: '可见方', value: 'P0' },
      ],
    }
  }

  if (protocol === 'MPSI-card-sum') {
    const sumValue = arithmeticSumLabel(setSize, parties)
    return {
      primary: sumValue,
      subtitle: '按共同元素对应数值求和',
      sample: [] as string[],
      rows: [
        { label: '输出类型', value: '交集元素求和' },
        { label: '交集数量', value: formatResultCount(sharedCount) },
        { label: '求和值', value: sumValue },
        { label: '可见方', value: 'P0' },
      ],
    }
  }

  return {
    primary: `${formatResultCount(sharedCount)} 个共同元素`,
    subtitle: '按多方共同元素集合计算',
    sample: [] as string[],
    rows: [
      { label: '输出类型', value: resultTypeLabels[protocol] },
      { label: '交集数量', value: formatResultCount(sharedCount) },
      { label: '可见方', value: 'P0' },
    ],
  }
}
