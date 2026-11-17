import { ComposerPill, Command, Plugin, type ComposerPillView } from "@opencode/plugin/gui"
import { createStore } from "solid-js/store"
import { ZaiQuota, type QuotaOutput, type OpenRouterOutput } from "./rpc.js"

const POLL_MS = 5 * 60_000

const usd = (v: number | null): string => (v === null ? "-" : `$${v.toFixed(2)}`)

function formatReset(resetsAt: number): string {
  if (!resetsAt) return ""
  const ms = resetsAt - Date.now()
  if (ms <= 0) return "now"
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `resets in ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `resets in ${hours}h ${minutes % 60}m`
  return `resets in ${Math.floor(hours / 24)}d ${hours % 24}h`
}

export default Plugin.define({
  setup(ctx) {
    const [state, setState] = createStore<{ data: QuotaOutput | undefined }>({ data: undefined })
    const [orState, setOrState] = createStore<{ data: OpenRouterOutput | undefined }>({ data: undefined })

    // NOTE: renderer.log only captures console.error/warn - use console.error for diagnostics here
    console.error("[zai-quota] gui setup, starting poll loops")

    // failure -> retry every 10s so a dead pill reconnects fast; success keeps POLL_MS
    const RETRY_MS = 10_000
    // hard client-side cap: during network chaos a fetch promise can hang forever
    // (no timeout in the transport), which would freeze the whole loop silently
    const CALL_TIMEOUT_MS = 15_000

    const withTimeout = async (p: Promise<unknown>, label: string) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        return await Promise.race([
          p,
          new Promise((_, rej) => {
            timer = setTimeout(() => rej(new Error(`${label}: client timeout ${CALL_TIMEOUT_MS}ms`)), CALL_TIMEOUT_MS)
          }),
        ])
      } finally {
        clearTimeout(timer)
      }
    }

    let zaiOk = false
    let orOk = false

    const refreshZai = async () => {
      try {
        const out = (await withTimeout(ctx.client.rpc(ZaiQuota).quota({}), "z.ai")) as QuotaOutput
        if (out.error && state.data && !state.data.error) {
          // keep last-known-good pill values instead of clobbering them with "?"
          console.error(`[zai-quota] z.ai: server error ${out.error} (keeping last values)`)
          return false
        }
        setState("data", out)
        console.error(`[zai-quota] z.ai: ${out.windows.map((w) => `${w.name} ${w.percent}%`).join(", ") || out.error || "no windows"}`)
      } catch (e) {
        console.error(`[zai-quota] z.ai rpc failed: ${e instanceof Error ? e.message : String(e)}`)
        return false
      }
      return true
    }

    const refreshOpenrouter = async () => {
      try {
        const out = (await withTimeout(ctx.client.rpc(ZaiQuota).openrouter({}), "openrouter")) as OpenRouterOutput
        if (out.error && orState.data && !orState.data.error) {
          // keep last-known-good pill values instead of clobbering them with "?"
          console.error(`[zai-quota] openrouter: server error ${out.error} (keeping last values)`)
          return false
        }
        setOrState("data", out)
        console.error(`[zai-quota] openrouter: available ${out.totalAvailable ?? "?"}${out.error ? ` error ${out.error}` : ""}`)
      } catch (e) {
        console.error(`[zai-quota] openrouter rpc failed: ${e instanceof Error ? e.message : String(e)}`)
        return false
      }
      return true
    }

    // independent loops per pill: success -> 5min, failure -> retry in 30s so a dead
    // pill reconnects on its own instead of freezing for the next full poll
    let disposed = false
    const loop = async (fn: () => Promise<boolean>) => {
      while (!disposed) {
        const good = await fn().catch(() => false)
        if (disposed) break
        await new Promise((r) => setTimeout(r, good ? POLL_MS : RETRY_MS))
      }
    }
    void loop(refreshZai)
    void loop(refreshOpenrouter)

    ctx.add(Command, {
      id: "refresh",
      title: "Refresh Z.AI usage",
      keywords: "zai glm quota usage limits",
      group: "Usage",
      section: "model",
      run: () => void refreshZai(),
    })

    ctx.add(Command, {
      id: "refresh-openrouter",
      title: "Refresh OpenRouter usage",
      keywords: "openrouter credits usage limits",
      group: "Usage",
      section: "model",
      run: () => void refreshOpenrouter(),
    })

    ctx.add(ComposerPill, {
      id: "quota",
      show: (): ComposerPillView | undefined => {
        const data = state.data
        if (!data) return { label: "z.ai …", icon: "status", title: "Z.AI quota: no data yet (retrying every 10s)" }
        if (data.error) {
          return { label: "z.ai ?", icon: "status", tone: "danger", title: `Z.AI quota: ${data.error}` }
        }
        const worst = data.windows.reduce((max, w) => Math.max(max, w.percent), 0)
        const tone = worst >= 90 ? ("danger" as const) : worst >= 70 ? ("warning" as const) : undefined
        const five = data.windows.find((w) => w.name === "5h")
        const week = data.windows.find((w) => w.name === "weekly")
        const parts: string[] = []
        if (five) parts.push(`5h ${five.percent}%`)
        if (week) parts.push(`wk ${week.percent}%`)
        if (parts.length === 0) parts.push("z.ai")
        return {
          label: parts.join(" · "),
          icon: "status",
          tone,
          title: `${data.label}${data.level ? ` (${data.level})` : ""}`,
          rows: data.windows.map((w) => ({
            id: w.name,
            label: `${w.name}: ${w.percent}% of ${(w.total / 1000).toFixed(0)}k`,
            icon: w.percent >= 90 ? "circle-x" : w.percent >= 70 ? "status" : "circle-check",
            tone: w.percent >= 90 ? ("danger" as const) : w.percent >= 70 ? ("warning" as const) : ("success" as const),
            detail: formatReset(w.resetsAt),
          })),
        }
      },
    })

    ctx.add(ComposerPill, {
      id: "openrouter",
      show: (): ComposerPillView | undefined => {
        const o = orState.data
        if (!o) return { label: "or …", icon: "status", title: "OpenRouter: no data yet (retrying every 10s)" }
        if (o.error) {
          return { label: "or ?", icon: "status", tone: "danger", title: `OpenRouter: ${o.error}` }
        }
        const left = o.remaining
        const tone =
          left !== null && left < 2 ? ("danger" as const) : left !== null && left < 5 ? ("warning" as const) : undefined
        const label = o.totalAvailable !== null ? usd(o.totalAvailable) : left !== null ? `${usd(left)} left` : `used ${usd(o.used)}`
        return {
          label,
          icon: "status",
          tone,
          title: `OpenRouter key${o.freeTier ? " (free tier)" : ""}`,
          rows: [
            { id: "balance", label: `account balance: ${usd(o.totalAvailable)} of ${usd(o.totalCredits)}`, icon: "circle-check", tone: "success", detail: `credits used ${usd(o.totalUsage)}` },
            { id: "limit", label: `key: ${left !== null ? `${usd(left)} of ${usd(o.limit)} left` : "no limit"}`, icon: "circle-check", tone: "success", detail: `used total ${usd(o.used)}` },
            { id: "today", label: `today ${usd(o.usedDaily)}`, icon: "status", tone: "success", detail: "" },
            { id: "week", label: `week ${usd(o.usedWeekly)}`, icon: "status", tone: "success", detail: "" },
            { id: "month", label: `month ${usd(o.usedMonthly)}`, icon: "status", tone: "success", detail: "" },
          ],
        }
      },
    })

    return () => {
      console.error("[zai-quota] gui setup disposed, stopping poll loops")
      disposed = true
    }
  },
})
