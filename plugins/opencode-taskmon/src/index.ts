import { Plugin } from "@opencode/plugin"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { TaskmonState, type ListOutput, type TaskState, type TaskView } from "./rpc.js"

// jobs publish status files here via the `taskmon` helper (or any JSON writer):
//   ~/.local/state/taskmon/<id>.json
// { id, label, current, total, state?, detail?, unit?, startedAt?, updatedAt? }
const STATUS_DIR = process.env.TASKMON_DIR ?? join(homedir(), ".local/state/taskmon")

const STALE_MS = 60_000 // running task whose file stopped updating
// hide a task once it has been finished (done/failed) or inactive (stale) for 5 min
const HIDE_MS = 5 * 60_000

interface RawTask {
  id: string
  label: string
  current: number
  total: number
  state?: string
  detail?: string
  unit?: string
  startedAt?: number
  updatedAt?: number
}

// per-task sample window for smoothed rate; filled on each poll
const samples = new Map<string, { t: number; current: number }[]>()

function readTasks(): RawTask[] {
  let names: string[]
  try {
    names = readdirSync(STATUS_DIR).filter((n) => n.endsWith(".json"))
  } catch {
    return []
  }
  const out: RawTask[] = []
  for (const name of names) {
    const path = join(STATUS_DIR, name)
    try {
      const raw = JSON.parse(readFileSync(path, "utf8")) as RawTask
      if (typeof raw.id !== "string" || typeof raw.label !== "string") continue
      raw.updatedAt ??= statSync(path).mtimeMs
      out.push(raw)
    } catch {
      // half-written or removed between readdir and read; skip
    }
  }
  return out
}

function pushSample(id: string, t: number, current: number): number | null {
  const arr = samples.get(id) ?? []
  arr.push({ t, current })
  while (arr.length > 30) arr.shift()
  samples.set(id, arr)
  // smoothed rate over the window
  const first = arr[0]
  const last = arr[arr.length - 1]
  const dt = last.t - first.t
  if (dt <= 0 || arr.length < 2) return null
  return (last.current - first.current) / (dt / 1000)
}

function normalize(raw: RawTask, now: number): TaskView {
  const rate = pushSample(raw.id, now, raw.current)
  const startedAt = raw.startedAt ?? raw.updatedAt ?? now
  const elapsedMs = Math.max(0, now - startedAt)
  const rateWhole = elapsedMs > 500 && raw.current > 0 ? raw.current / (elapsedMs / 1000) : null
  const useRate = rate ?? rateWhole
  const total = Number.isFinite(raw.total) ? raw.total : 0
  const pct = total > 0 ? Math.max(0, Math.min(100, (raw.current / total) * 100)) : null
  const etaMs = useRate && useRate > 0 && total > 0 && raw.current < total
    ? ((total - raw.current) / useRate) * 1000
    : null
  let state: TaskState = raw.state === "done" || raw.state === "failed" ? raw.state : "running"
  if (state === "running" && now - (raw.updatedAt ?? now) > STALE_MS) state = "stale"
  return {
    id: raw.id,
    label: raw.label,
    state,
    current: raw.current,
    total,
    pct,
    rate,
    rateWhole,
    etaMs: state === "running" ? etaMs : null,
    elapsedMs,
    detail: raw.detail ?? "",
    unit: raw.unit ?? "",
    updatedAt: raw.updatedAt ?? now,
  }
}

function sortKey(t: TaskView): number {
  if (t.state === "running") return 0
  if (t.state === "stale") return 1
  if (t.state === "failed") return 2
  return 3 // done
}

export default Plugin.define({
  id: "taskmon",
  setup(ctx) {
    void ctx
    void ctx.rpc.register(TaskmonState, {
      list: async (): Promise<ListOutput> => {
        const now = Date.now()
        const tasks = readTasks()
          .map((raw) => normalize(raw, now))
          .filter((t) => {
            if (t.state === "running") return true
            return now - t.updatedAt < HIDE_MS
          })
          .sort((a, b) => sortKey(a) - sortKey(b) || a.label.localeCompare(b.label))
        return { tasks, fetchedAt: now }
      },
    })
    return () => samples.clear()
  },
})
