import { Plugin } from "@opencode/plugin"
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { ZaiQuota, type QuotaOutput, type QuotaWindow, type OpenRouterOutput } from "./rpc.js"

const INTEGRATION_ID = "zai-coding-plan"

interface OrKeyData {
  limit?: number | null
  limit_remaining?: number | null
  usage?: number
  usage_daily?: number | null
  usage_weekly?: number | null
  usage_monthly?: number | null
  is_free_tier?: boolean | null
}

function openrouterKey(options: Record<string, unknown>): string {
  const env = process.env.OPENROUTER_API_KEY
  if (env) return env
  const raw = typeof options.openrouterKeyPath === "string" && options.openrouterKeyPath
    ? options.openrouterKeyPath
    : "~/.claude-code-router/config.json"
  const path = raw.replace(/^~(?=\/|$)/, homedir())
  const cfg = JSON.parse(readFileSync(path, "utf8")) as { Providers?: { name: string; api_key: string }[] }
  const provider = cfg.Providers?.find((x) => x.name === "openrouter")
  if (!provider?.api_key) throw new Error(`no openrouter key in ${path}`)
  return provider.api_key
}

async function fetchOpenRouter(key: string): Promise<OpenRouterOutput> {
  const headers = { Authorization: `Bearer ${key}` }
  const [keyRes, creditsRes] = await Promise.all([
    fetch("https://openrouter.ai/api/v1/auth/key", { headers }),
    fetch("https://openrouter.ai/api/v1/credits", { headers }).catch(() => undefined),
  ])
  if (!keyRes.ok) throw new Error(`openrouter HTTP ${keyRes.status}`)
  const body = (await keyRes.json()) as { data?: OrKeyData }
  const d = body.data ?? {}
  let totalCredits: number | null = null
  let totalUsage: number | null = null
  let totalAvailable: number | null = null
  if (creditsRes?.ok) {
    const c = (await creditsRes.json() as { data?: { total_credits?: number; total_usage?: number } }).data
    if (c && typeof c.total_credits === "number") {
      totalCredits = c.total_credits
      totalUsage = c.total_usage ?? 0
      totalAvailable = c.total_credits - (c.total_usage ?? 0)
    }
  }
  return {
    remaining: d.limit_remaining ?? null,
    limit: d.limit ?? null,
    used: d.usage ?? 0,
    usedDaily: d.usage_daily ?? null,
    usedWeekly: d.usage_weekly ?? null,
    usedMonthly: d.usage_monthly ?? null,
    freeTier: d.is_free_tier ?? null,
    totalCredits,
    totalUsage,
    totalAvailable,
    fetchedAt: Date.now(),
  }
}

const usd = (v: number | null): string => (v === null ? "-" : `$${v.toFixed(2)}`)

function renderOpenRouter(o: OpenRouterOutput): string {
  const left = o.remaining === null ? `used ${usd(o.used)} (no key limit)` : `${usd(o.remaining)} of ${usd(o.limit)} left`
  return [
    `### OpenRouter${o.freeTier ? " (free tier)" : ""}`,
    "",
    `- **account balance available: ${usd(o.totalAvailable)}** (${usd(o.totalCredits)} credits - ${usd(o.totalUsage)} used)`,
    `- key: ${left}`,
    `- used: today ${usd(o.usedDaily)} / week ${usd(o.usedWeekly)} / month ${usd(o.usedMonthly)}`,
  ].join("\n")
}


interface ZaiLimit {
  type: string
  unit: number
  number: number
  usage: number
  currentValue: number
  remaining: number
  percentage: number
  nextResetTime: number
}

interface ZaiQuotaResponse {
  code: number
  msg?: string
  success?: boolean
  data?: { limits?: ZaiLimit[]; level?: string }
}

function windowName(limit: ZaiLimit): string {
  if (limit.unit === 3 && limit.number === 5) return "5h"
  if (limit.unit === 6) return "weekly"
  if (limit.unit === 3) return `${limit.number}h`
  return `${limit.number}x unit${limit.unit}`
}

async function activeKey(ctx: { integration: { connection: { active(id: string): Promise<unknown>; resolve(c: unknown): Promise<unknown> } } }): Promise<string> {
  const connection = await ctx.integration.connection.active(INTEGRATION_ID)
  if (!connection) throw new Error(`no active ${INTEGRATION_ID} credential`)
  const credential = await ctx.integration.connection.resolve(connection)
  const key =
    typeof credential === "string"
      ? credential
      : credential && typeof credential === "object" && "key" in credential
        ? String((credential as { key: unknown }).key)
        : undefined
  if (!key) throw new Error("could not resolve z.ai credential value")
  return key
}

async function fetchQuota(key: string): Promise<QuotaOutput> {
  const response = await fetch("https://api.z.ai/api/monitor/usage/quota/limit", {
    headers: {
      // z.ai expects the raw key, deliberately NO "Bearer" prefix
      Authorization: key,
      "Accept-Language": "en-US,en",
      "Content-Type": "application/json",
    },
  })
  if (!response.ok) {
    throw new Error(`z.ai quota HTTP ${response.status}`)
  }
  const body = (await response.json()) as ZaiQuotaResponse
  if (body.code !== 200 || !body.data?.limits) {
    throw new Error(body.msg || `z.ai quota code ${body.code}`)
  }
  const windows: QuotaWindow[] = body.data.limits.map((limit) => ({
    name: windowName(limit),
    percent: limit.percentage,
    used: limit.currentValue,
    total: limit.usage,
    resetsAt: limit.nextResetTime,
  }))
  return {
    label: "Z.AI Coding Plan",
    level: body.data.level || "",
    windows,
    fetchedAt: Date.now(),
  }
}

function resetIn(resetsAt: number): string {
  if (!resetsAt) return "-"
  const ms = resetsAt - Date.now()
  if (ms <= 0) return "now"
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

function renderMarkdown(q: QuotaOutput): string {
  const rows = q.windows
    .map(
      (w) =>
        `| ${w.name} | ${w.percent}% | ${w.used.toLocaleString()} / ${w.total.toLocaleString()} | ${resetIn(w.resetsAt)} |`,
    )
    .join("\n")
  return [
    `### Z.AI GLM Coding Plan${q.level ? ` (${q.level})` : ""}`,
    "",
    "| window | used | tokens | resets in |",
    "|--------|-----:|--------|-----------|",
    rows,
  ].join("\n")
}

export default Plugin.define({
  id: "zai-quota",
  async setup(ctx) {
    await ctx.rpc.register(ZaiQuota, {
      quota: async () => {
        const base: QuotaOutput = { label: "Z.AI Coding Plan", level: "", windows: [], fetchedAt: Date.now() }
        try {
          const quota = await fetchQuota(await activeKey(ctx))
          return quota
        } catch (e) {
          return { ...base, error: e instanceof Error ? e.message : String(e) }
        }
      },
      openrouter: async () => {
        const base: OpenRouterOutput = {
          remaining: null, limit: null, used: 0, usedDaily: null, usedWeekly: null, usedMonthly: null,
          freeTier: null, totalCredits: null, totalUsage: null, totalAvailable: null, fetchedAt: Date.now(),
        }
        try {
          return await fetchOpenRouter(openrouterKey(ctx.options as Record<string, unknown>))
        } catch (e) {
          return { ...base, error: e instanceof Error ? e.message : String(e) }
        }
      },
    })

    const toolReg = await ctx.tool.transform((editor) => {
      editor.add({
        name: "glm_quota",
        description:
          "Query Z.AI GLM coding plan usage: quota windows (5h token cycle, weekly) with percentages, token totals and reset times. Returns a markdown table.",
        input: { type: "object", properties: {}, required: [], additionalProperties: false },
        execute: async () => {
          try {
            const quota = await fetchQuota(await activeKey(ctx))
            return { content: renderMarkdown(quota) }
          } catch (e) {
            return { content: `glm_quota failed: ${e instanceof Error ? e.message : String(e)}` }
          }
        },
      })
      editor.add({
        name: "openrouter_usage",
        description:
          "Query OpenRouter API key usage and remaining credits (USD): key limit, remaining, and today/week/month spend. Returns markdown.",
        input: { type: "object", properties: {}, required: [], additionalProperties: false },
        execute: async () => {
          try {
            const usage = await fetchOpenRouter(openrouterKey(ctx.options as Record<string, unknown>))
            return { content: renderOpenRouter(usage) }
          } catch (e) {
            return { content: `openrouter_usage failed: ${e instanceof Error ? e.message : String(e)}` }
          }
        },
      })
    })

    return () => {
      void toolReg.dispose()
    }
  },
})
