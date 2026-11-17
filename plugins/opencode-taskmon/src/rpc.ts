import { Rpc } from "@opencode/plugin/rpc"

export type TaskState = "running" | "done" | "failed" | "stale"

export interface TaskView {
  id: string
  label: string
  state: TaskState
  current: number
  total: number
  pct: number | null
  /** smoothed units/second over the recent sample window */
  rate: number | null
  /** average units/second since the job started */
  rateWhole: number | null
  etaMs: number | null
  elapsedMs: number
  detail: string
  unit: string
  updatedAt: number
}

export interface ListOutput {
  tasks: TaskView[]
  fetchedAt: number
}

// 2.2.1 quirks: methods REQUIRE errors: {}, Rpc.define REQUIREs events: {}
// and an explicit input schema, else plugin dies with "Object.entries
// requires that input parameter not be null or undefined".
export const TaskmonState = Rpc.define({
  id: "taskmon",
  events: {},
  methods: {
    list: {
      input: { type: "object", properties: {}, additionalProperties: false },
      errors: {},
      output: {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                state: { type: "string", enum: ["running", "done", "failed", "stale"] },
                current: { type: "number" },
                total: { type: "number" },
                pct: { type: ["number", "null"] },
                rate: { type: ["number", "null"] },
                rateWhole: { type: ["number", "null"] },
                etaMs: { type: ["number", "null"] },
                elapsedMs: { type: "number" },
                detail: { type: "string" },
                unit: { type: "string" },
                updatedAt: { type: "number" },
              },
              required: [
                "id", "label", "state", "current", "total", "pct", "rate", "rateWhole",
                "etaMs", "elapsedMs", "detail", "unit", "updatedAt",
              ],
              additionalProperties: false,
            },
          },
          fetchedAt: { type: "number" },
        },
        required: ["tasks", "fetchedAt"],
        additionalProperties: false,
      },
    },
  },
})
