import { Rpc } from "@opencode/plugin/rpc"

export interface QuotaWindow {
  name: string
  percent: number
  used: number
  total: number
  resetsAt: number
}

export interface QuotaOutput {
  label: string
  level: string
  windows: QuotaWindow[]
  error?: string
  fetchedAt: number
}

export interface OpenRouterOutput {
  remaining: number | null
  limit: number | null
  used: number
  usedDaily: number | null
  usedWeekly: number | null
  usedMonthly: number | null
  freeTier: boolean | null
  error?: string
  fetchedAt: number
}

export const ZaiQuota = Rpc.define({
  id: "zai-quota",
  events: {},
  methods: {
    quota: {
      input: { type: "object", properties: {}, additionalProperties: false },
      errors: {},
      output: {
        type: "object",
        properties: {
          label: { type: "string" },
          level: { type: "string" },
          windows: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                percent: { type: "number" },
                used: { type: "number" },
                total: { type: "number" },
                resetsAt: { type: "number" },
              },
              required: ["name", "percent", "used", "total", "resetsAt"],
              additionalProperties: false,
            },
          },
          error: { type: "string" },
          fetchedAt: { type: "number" },
        },
        required: ["label", "level", "windows", "fetchedAt"],
        additionalProperties: false,
      },
    },
    openrouter: {
      input: { type: "object", properties: {}, additionalProperties: false },
      errors: {},
      output: {
        type: "object",
        properties: {
          remaining: { type: ["number", "null"] },
          limit: { type: ["number", "null"] },
          used: { type: "number" },
          usedDaily: { type: ["number", "null"] },
          usedWeekly: { type: ["number", "null"] },
          usedMonthly: { type: ["number", "null"] },
          freeTier: { type: ["boolean", "null"] },
          totalCredits: { type: ["number", "null"] },
          totalUsage: { type: ["number", "null"] },
          totalAvailable: { type: ["number", "null"] },
          error: { type: "string" },
          fetchedAt: { type: "number" },
        },
        required: ["remaining", "limit", "used", "usedDaily", "usedWeekly", "usedMonthly", "freeTier", "totalCredits", "totalUsage", "totalAvailable", "fetchedAt"],
        additionalProperties: false,
      },
    },
  },
})
