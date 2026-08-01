import 'server-only'

import { Pool } from 'pg'
import { parseOnlineCommunicationMiB } from '@/lib/server/mpso-metrics'

export type RunStatus = 'queued' | 'running' | 'completed' | 'failed'
export type RunPhase = 'queued' | 'preparing' | 'running' | 'finalizing' | 'completed' | 'failed'

export type MpsoRunSample = {
  id: number
  runId: string
  datasetPower: number
  setSize: number
  resultType: string
  resultValue: Record<string, number | string | boolean>
  oursOnlineMs: number
  sotaMultiplier: number | null
  sotaOnlineMs: number | null
  oursCommMiB: number | null
  sotaCommMiB: number | null
  benchmarkParties: number | null
  benchmarkPower: number | null
  preparationMs: number
  rawLog: string
  createdAt: string
}

export type MpsoRun = {
  id: string
  protocol: string
  parties: number
  dataset: string
  threads: number
  status: RunStatus
  phase: RunPhase
  currentPower: number | null
  error: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  samples: MpsoRunSample[]
}

type NewSample = Omit<MpsoRunSample, 'id' | 'createdAt'>

const globalForDatabase = globalThis as unknown as {
  mpsoPool?: Pool
  mpsoSchemaPromise?: Promise<void>
}

function databaseUrl() {
  const value = process.env.DATABASE_URL
  if (!value) {
    throw new Error('DATABASE_URL 未配置，无法连接 PostgreSQL')
  }
  return value
}

export function getMpsoPool() {
  if (!globalForDatabase.mpsoPool) {
    globalForDatabase.mpsoPool = new Pool({
      connectionString: databaseUrl(),
      max: 5,
      idleTimeoutMillis: 30_000,
    })
  }
  return globalForDatabase.mpsoPool
}

export function ensureMpsoSchema() {
  if (!globalForDatabase.mpsoSchemaPromise) {
    globalForDatabase.mpsoSchemaPromise = getMpsoPool().query(`
      CREATE TABLE IF NOT EXISTS mpso_runs (
        id UUID PRIMARY KEY,
        protocol TEXT NOT NULL,
        parties INTEGER NOT NULL CHECK (parties BETWEEN 2 AND 10),
        dataset TEXT NOT NULL,
        threads INTEGER NOT NULL CHECK (threads BETWEEN 1 AND 64),
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
        phase TEXT NOT NULL CHECK (phase IN ('queued', 'preparing', 'running', 'finalizing', 'completed', 'failed')),
        current_power INTEGER,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        finished_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS mpso_run_samples (
        id BIGSERIAL PRIMARY KEY,
        run_id UUID NOT NULL REFERENCES mpso_runs(id) ON DELETE CASCADE,
        dataset_power INTEGER NOT NULL,
        set_size BIGINT NOT NULL,
        result_type TEXT NOT NULL,
        result_value JSONB NOT NULL,
        ours_online_ms DOUBLE PRECISION NOT NULL,
        sota_multiplier DOUBLE PRECISION,
        sota_online_ms DOUBLE PRECISION,
        ours_comm_mib DOUBLE PRECISION,
        sota_comm_mib DOUBLE PRECISION,
        benchmark_parties INTEGER,
        benchmark_power INTEGER,
        preparation_ms DOUBLE PRECISION NOT NULL,
        raw_log TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (run_id, dataset_power)
      );

      CREATE INDEX IF NOT EXISTS mpso_runs_created_at_idx ON mpso_runs (created_at DESC);
      CREATE INDEX IF NOT EXISTS mpso_run_samples_run_id_idx ON mpso_run_samples (run_id, dataset_power);
    `).then(() => undefined).catch((error) => {
      globalForDatabase.mpsoSchemaPromise = undefined
      throw error
    })
  }
  return globalForDatabase.mpsoSchemaPromise
}

function iso(value: Date | string | null) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function mapRun(row: Record<string, unknown>): Omit<MpsoRun, 'samples'> {
  return {
    id: String(row.id),
    protocol: String(row.protocol),
    parties: Number(row.parties),
    dataset: String(row.dataset),
    threads: Number(row.threads),
    status: row.status as RunStatus,
    phase: row.phase as RunPhase,
    currentPower: row.current_power === null ? null : Number(row.current_power),
    error: row.error === null ? null : String(row.error),
    createdAt: iso(row.created_at as Date | string)!,
    startedAt: iso(row.started_at as Date | string | null),
    finishedAt: iso(row.finished_at as Date | string | null),
  }
}

function mapSample(row: Record<string, unknown>): MpsoRunSample {
  const rawLog = String(row.raw_log ?? '')
  const storedOursCommMiB = row.ours_comm_mib === null ? null : Number(row.ours_comm_mib)
  return {
    id: Number(row.id),
    runId: String(row.run_id),
    datasetPower: Number(row.dataset_power),
    setSize: Number(row.set_size),
    resultType: String(row.result_type),
    resultValue: row.result_value as MpsoRunSample['resultValue'],
    oursOnlineMs: Number(row.ours_online_ms),
    sotaMultiplier: row.sota_multiplier === null ? null : Number(row.sota_multiplier),
    sotaOnlineMs: row.sota_online_ms === null ? null : Number(row.sota_online_ms),
    oursCommMiB: storedOursCommMiB ?? parseOnlineCommunicationMiB(rawLog),
    sotaCommMiB: row.sota_comm_mib === null ? null : Number(row.sota_comm_mib),
    benchmarkParties: row.benchmark_parties === null ? null : Number(row.benchmark_parties),
    benchmarkPower: row.benchmark_power === null ? null : Number(row.benchmark_power),
    preparationMs: Number(row.preparation_ms),
    rawLog,
    createdAt: iso(row.created_at as Date | string)!,
  }
}

export async function createMpsoRun(input: {
  id: string
  protocol: string
  parties: number
  dataset: string
  threads: number
}) {
  await ensureMpsoSchema()
  await getMpsoPool().query(
    `INSERT INTO mpso_runs (id, protocol, parties, dataset, threads, status, phase)
     VALUES ($1, $2, $3, $4, $5, 'queued', 'queued')`,
    [input.id, input.protocol, input.parties, input.dataset, input.threads],
  )
}

export async function markMpsoRunStarted(id: string) {
  await ensureMpsoSchema()
  await getMpsoPool().query(
    `UPDATE mpso_runs
     SET status = 'running', phase = 'preparing', started_at = COALESCE(started_at, NOW()), error = NULL
     WHERE id = $1`,
    [id],
  )
}

export async function updateMpsoRunPhase(id: string, phase: RunPhase, currentPower: number | null) {
  await ensureMpsoSchema()
  await getMpsoPool().query(
    'UPDATE mpso_runs SET phase = $2, current_power = $3 WHERE id = $1',
    [id, phase, currentPower],
  )
}

export async function insertMpsoRunSample(sample: NewSample) {
  await ensureMpsoSchema()
  await getMpsoPool().query(
    `INSERT INTO mpso_run_samples (
       run_id, dataset_power, set_size, result_type, result_value,
       ours_online_ms, sota_multiplier, sota_online_ms,
       ours_comm_mib, sota_comm_mib, benchmark_parties, benchmark_power,
       preparation_ms, raw_log
     ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (run_id, dataset_power) DO UPDATE SET
       set_size = EXCLUDED.set_size,
       result_type = EXCLUDED.result_type,
       result_value = EXCLUDED.result_value,
       ours_online_ms = EXCLUDED.ours_online_ms,
       sota_multiplier = EXCLUDED.sota_multiplier,
       sota_online_ms = EXCLUDED.sota_online_ms,
       ours_comm_mib = EXCLUDED.ours_comm_mib,
       sota_comm_mib = EXCLUDED.sota_comm_mib,
       benchmark_parties = EXCLUDED.benchmark_parties,
       benchmark_power = EXCLUDED.benchmark_power,
       preparation_ms = EXCLUDED.preparation_ms,
       raw_log = EXCLUDED.raw_log`,
    [
      sample.runId,
      sample.datasetPower,
      sample.setSize,
      sample.resultType,
      JSON.stringify(sample.resultValue),
      sample.oursOnlineMs,
      sample.sotaMultiplier,
      sample.sotaOnlineMs,
      sample.oursCommMiB,
      sample.sotaCommMiB,
      sample.benchmarkParties,
      sample.benchmarkPower,
      sample.preparationMs,
      sample.rawLog,
    ],
  )
}

export async function completeMpsoRun(id: string) {
  await ensureMpsoSchema()
  await getMpsoPool().query(
    `UPDATE mpso_runs
     SET status = 'completed', phase = 'completed', current_power = NULL, finished_at = NOW()
     WHERE id = $1`,
    [id],
  )
}

export async function failMpsoRun(id: string, error: string) {
  await ensureMpsoSchema()
  await getMpsoPool().query(
    `UPDATE mpso_runs
     SET status = 'failed', phase = 'failed', current_power = NULL, error = $2, finished_at = NOW()
     WHERE id = $1`,
    [id, error.slice(0, 4000)],
  )
}

export async function getMpsoRun(id: string): Promise<MpsoRun | null> {
  await ensureMpsoSchema()
  const [runResult, sampleResult] = await Promise.all([
    getMpsoPool().query('SELECT * FROM mpso_runs WHERE id = $1', [id]),
    getMpsoPool().query('SELECT * FROM mpso_run_samples WHERE run_id = $1 ORDER BY dataset_power', [id]),
  ])
  if (!runResult.rowCount) return null
  return {
    ...mapRun(runResult.rows[0]),
    samples: sampleResult.rows.map(mapSample),
  }
}

export async function listMpsoRuns(limit = 30): Promise<MpsoRun[]> {
  await ensureMpsoSchema()
  const boundedLimit = Math.min(100, Math.max(1, limit))
  const runResult = await getMpsoPool().query(
    'SELECT * FROM mpso_runs ORDER BY created_at DESC LIMIT $1',
    [boundedLimit],
  )
  if (!runResult.rowCount) return []
  const ids = runResult.rows.map((row) => row.id)
  const sampleResult = await getMpsoPool().query(
    'SELECT * FROM mpso_run_samples WHERE run_id = ANY($1::uuid[]) ORDER BY dataset_power',
    [ids],
  )
  const samplesByRun = new Map<string, MpsoRunSample[]>()
  for (const row of sampleResult.rows) {
    const sample = mapSample(row)
    const samples = samplesByRun.get(sample.runId) ?? []
    samples.push(sample)
    samplesByRun.set(sample.runId, samples)
  }
  return runResult.rows.map((row) => {
    const run = mapRun(row)
    return { ...run, samples: samplesByRun.get(run.id) ?? [] }
  })
}

export async function checkMpsoDatabase() {
  await ensureMpsoSchema()
  const result = await getMpsoPool().query<{ database: string; user_name: string }>(
    'SELECT current_database() AS database, current_user AS user_name',
  )
  return result.rows[0]
}
