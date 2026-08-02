#!/usr/bin/env bash

set -Eeuo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:4173}"
REQUEST_TIMEOUT_SECONDS="${REQUEST_TIMEOUT_SECONDS:-1800}"

if [[ ! "$REQUEST_TIMEOUT_SECONDS" =~ ^[0-9]+$ ]] ||
   (( REQUEST_TIMEOUT_SECONDS < 10 )); then
  printf 'Error: REQUEST_TIMEOUT_SECONDS must be an integer of at least 10.\n' >&2
  exit 1
fi

command -v node >/dev/null 2>&1 || {
  printf 'Error: Node.js is required for platform verification.\n' >&2
  exit 1
}

BASE_URL="${BASE_URL%/}" \
REQUEST_TIMEOUT_SECONDS="$REQUEST_TIMEOUT_SECONDS" \
node <<'NODE'
const baseUrl = process.env.BASE_URL
const timeoutMs = Number(process.env.REQUEST_TIMEOUT_SECONDS) * 1000
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function readJson(response, context) {
  let body
  try {
    body = await response.json()
  } catch {
    throw new Error(`${context} returned a non-JSON response with status ${response.status}`)
  }
  if (!response.ok) {
    throw new Error(`${context} failed with status ${response.status}: ${JSON.stringify(body)}`)
  }
  return body
}

async function createRun(input) {
  const response = await fetch(`${baseUrl}/api/runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  const created = await readJson(response, 'Run creation')
  assert(created.id, `Run creation did not return an id: ${JSON.stringify(created)}`)
  return created.id
}

async function waitForRun(id) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const response = await fetch(`${baseUrl}/api/runs/${id}`, { cache: 'no-store' })
    const run = await readJson(response, `Run ${id}`)
    if (run.status === 'failed') {
      throw new Error(`Run ${id} failed: ${run.error ?? 'unknown error'}`)
    }
    if (run.status === 'completed') return run
    await sleep(500)
  }
  throw new Error(`Run ${id} did not complete within ${timeoutMs / 1000} seconds`)
}

function parseMarkedJson(rawLog, marker) {
  const markerIndex = rawLog.indexOf(marker)
  assert(markerIndex >= 0, `Expected marker ${marker.trim()} was not found in the raw log`)
  const line = rawLog.slice(markerIndex + marker.length).split(/\r?\n/, 1)[0]
  try {
    return JSON.parse(line)
  } catch {
    throw new Error(`Unable to parse ${marker.trim()} payload: ${line}`)
  }
}

function validateCommonSample(run) {
  assert(run.samples?.length === 1, `Run ${run.id} returned ${run.samples?.length ?? 0} samples`)
  const sample = run.samples[0]
  assert(sample.resultValue?.verified === true, `Run ${run.id} did not verify its result`)
  assert(Number.isFinite(sample.oursOnlineMs) && sample.oursOnlineMs > 0,
    `Run ${run.id} did not record positive online time`)
  assert(Number.isFinite(sample.oursCommMiB) && sample.oursCommMiB > 0,
    `Run ${run.id} did not record positive online communication`)
  return sample
}

async function verifyTaihangRun(testCase) {
  const id = await createRun({
    protocol: testCase.label,
    parties: 2,
    dataset: '12',
    threads: 4,
  })
  const run = await waitForRun(id)
  const sample = validateCommonSample(run)
  assert(sample.preparationMs === 0, `Taihang run ${id} reported a nonzero offline phase`)
  assert(sample.sotaMultiplier === null && sample.sotaOnlineMs === null && sample.sotaCommMiB === null,
    `Taihang run ${id} unexpectedly contained SOTA data`)

  const native = parseMarkedJson(sample.rawLog, 'TAIHANG_RESULT_JSON ')
  assert(native.success === true, `Taihang run ${id} reported failure`)
  assert(native.protocol === testCase.mode,
    `Taihang run ${id} used mode ${native.protocol}, expected ${testCase.mode}`)
  assert(native.parties === 2 && native.datasetPower === 12 && native.setSize === 4096,
    `Taihang run ${id} used unexpected run parameters`)
  assert(native.curve === 'X25519' && native.membership === 'PlainSet',
    `Taihang run ${id} used ${native.curve} + ${native.membership}`)
  assert(native.preparationMs === 0, `Taihang run ${id} returned nonzero preparation time`)
  assert(Number.isFinite(native.communicationMiB) && native.communicationMiB > 0,
    `Taihang run ${id} returned invalid communication`)

  const resultKey = testCase.mode === 'psics' ? 'resultSum' : 'resultCount'
  assert(native[resultKey] === testCase.expected,
    `Taihang run ${id} returned ${native[resultKey]}, expected ${testCase.expected}`)

  console.log(
    `PASS Taihang ${testCase.mode}: result=${native[resultKey]}, ` +
    `online=${native.onlineMs.toFixed(3)} ms, communication=${native.communicationMiB.toFixed(6)} MiB`,
  )
}

async function verifyMpsoRun() {
  const id = await createRun({
    protocol: '\u9690\u79c1\u96c6\u5408\u6c42\u4ea4\u96c6',
    parties: 3,
    dataset: '12',
    threads: 4,
  })
  const run = await waitForRun(id)
  const sample = validateCommonSample(run)
  assert(sample.preparationMs > 0, `MPSO run ${id} did not record offline preparation time`)
  const native = parseMarkedJson(sample.rawLog, 'MPSO_RESULT_JSON ')
  assert(native.success === true && native.parties === 3 && native.datasetPower === 12,
    `MPSO run ${id} returned unexpected native parameters`)
  console.log(
    `PASS MPSO mpsi: result=${native.resultCount}, ` +
    `online=${native.onlineMs.toFixed(3)} ms, communication=${sample.oursCommMiB.toFixed(6)} MiB`,
  )
}

const health = await readJson(await fetch(`${baseUrl}/api/health`, { cache: 'no-store' }), 'Health check')
assert(health.status === 'ok', `Health status is ${health.status}`)
assert(health.database?.database && health.database?.user_name, 'Health check did not verify PostgreSQL')
assert(health.mpsoBuildDirectory, 'Health check did not expose the MPSO build directory')
assert(health.taihangPsoExecutable, 'Health check did not expose the Taihang adapter')
console.log(`PASS health: database=${health.database.database}, user=${health.database.user_name}`)

const taihangTests = [
  {
    label: '\u9690\u79c1\u96c6\u5408\u6c42\u4ea4\u96c6',
    mode: 'psi',
    expected: 4095,
  },
  {
    label: '\u9690\u79c1\u96c6\u5408\u6c42\u5e76\u96c6',
    mode: 'psu',
    expected: 4097,
  },
  {
    label: '\u9690\u79c1\u96c6\u5408\u6c42\u4ea4\u96c6\u6570\u91cf',
    mode: 'psic',
    expected: 4095,
  },
  {
    label: '\u9690\u79c1\u96c6\u5408\u6c42\u4ea4\u96c6\u7684\u548c',
    mode: 'psics',
    expected: 8390655,
  },
]

for (const testCase of taihangTests) await verifyTaihangRun(testCase)
await verifyMpsoRun()
console.log('Platform verification completed successfully.')
NODE
