import { ComposerPill, Plugin, type ComposerPillView } from "@opencode/plugin/gui"
import { createStore } from "solid-js/store"
import { TaskmonState, type TaskView } from "./rpc.js"

const POLL_MS = 2_500

const RUN_ORDER: Record<string, number> = { running: 0, stale: 1, failed: 2, done: 3 }

function fmtBytes(v: number): string {
  if (v < 1024) return `${v} B`
  const units = ["KB", "MB", "GB", "TB"]
  let x = v
  let i = -1
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024
    i++
  }
  return `${x >= 100 ? x.toFixed(0) : x.toFixed(1)} ${units[i]}`
}

function fmtAmount(v: number, unit: string): string {
  if (!unit || unit === "B" || unit === "bytes") return fmtBytes(v)
  return `${v >= 1000 ? v.toFixed(0) : v.toFixed(1)} ${unit}`
}

function fmtRate(t: TaskView): string {
  const r = t.rate ?? t.rateWhole
  if (r === null || r <= 0) return ""
  const perSec = !t.unit || t.unit === "B" || t.unit === "bytes" ? `${fmtBytes(r)}/s` : `${r.toFixed(1)} ${t.unit}/s`
  return perSec
}

function fmtEta(t: TaskView): string {
  if (t.etaMs === null) return ""
  const s = Math.round(t.etaMs / 1000)
  if (s < 90) return `${s}s left`
  const m = Math.round(s / 60)
  if (m < 90) return `${m}m left`
  return `${Math.floor(m / 60)}h ${m % 60}m left`
}

function fmtElapsed(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 90) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 90) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function shortLabel(label: string, max = 18): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label
}

export default Plugin.define({
  setup(ctx) {
    const [state, setState] = createStore<{ tasks: TaskView[] }>({ tasks: [] })

    const refresh = async () => {
      try {
        const out = await ctx.client.rpc(TaskmonState).list({})
        setState("tasks", out.tasks)
      } catch {
        // server unreachable or plugin not registered yet; keep last snapshot
      }
    }

    void refresh()
    const timer = setInterval(() => void refresh(), POLL_MS)

    ctx.add(ComposerPill, {
      id: "taskmon",
      show: (): ComposerPillView | undefined => {
        const tasks = state.tasks
        if (tasks.length === 0) return undefined
        const failed = tasks.find((t) => t.state === "failed")
        const stale = tasks.find((t) => t.state === "stale")
        const primary = failed ?? stale ?? tasks[0]
        const pct = primary.pct === null ? "?" : `${Math.round(primary.pct)}%`
        const tail = primary.state === "failed" ? "FAILED" : primary.state === "done" ? "done" : fmtEta(primary) || pct
        const label =
          tasks.length > 1
            ? `${shortLabel(primary.label)} ${primary.state === "done" ? "" : `${pct} · `}${tail} +${tasks.length - 1}`
            : `${shortLabel(primary.label)} ${primary.state === "done" ? "done" : `${pct} · ${tail}`}`
        const tone = failed ? ("danger" as const) : stale ? ("warning" as const) : ("success" as const)
        return {
          label: label.trim(),
          icon: "status",
          tone: primary.state === "done" ? ("success" as const) : tone,
          title: `task monitor - ${tasks.length} job${tasks.length > 1 ? "s" : ""}`,
          rows: tasks.map((t) => {
            const parts = [
              t.pct === null ? "" : `${Math.round(t.pct)}%`,
              fmtRate(t),
              t.state === "running" ? fmtEta(t) : t.state === "stale" ? "stale (no updates)" : t.state.toUpperCase(),
              fmtElapsed(t.elapsedMs),
            ].filter(Boolean)
            return {
              id: t.id,
              label: `${shortLabel(t.label, 30)}: ${fmtAmount(t.current, t.unit)}${t.total > 0 ? ` / ${fmtAmount(t.total, t.unit)}` : ""}`,
              icon: t.state === "failed" ? "circle-x" : t.state === "running" ? "status" : "circle-check",
              tone: t.state === "failed" ? ("danger" as const) : t.state === "stale" ? ("warning" as const) : ("success" as const),
              detail: parts.join(" · ") + (t.detail ? ` · ${t.detail}` : ""),
            }
          }),
        }
      },
    })

    return () => clearInterval(timer)
  },
})
