import { Plugin } from "@opencode/plugin"
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { basename, join } from "node:path"

// Append-only JSONL log of concurrent-session count changes.
//
//   ~/.local/state/opencode-session-log/sessions.jsonl   one JSON object per count transition
//   ~/.local/state/opencode-session-log/state.json       { totalCreated, updatedAt } cumulative counter
//
// "sessions" = top-level (parentless) sessions that exist, are not deleted and not archived -
// i.e. what the desktop sidebar shows. "busy" = how many of those are executing right now.
// Child sessions (subagents, forks) don't move the headline counts but are mentioned on their
// create line and counted in "children" (busy children) for context.
//
// The server instantiates this plugin once per project it hosts (7 on my desktop setup), all
// seeing the same global event stream. Every instance maintains identical in-memory state, but
// only the elected leader writes - otherwise every line would land 7 times. Leadership is a
// globalThis token: single-threaded per process, self-healing across plugin hot-reloads (the
// first instance to notice a vacant throne claims it; a 15s timer covers quiet periods).

const STATE_DIR = process.env.SESSION_LOG_DIR ?? join(homedir(), ".local/state/opencode-session-log")
const LOG_FILE = join(STATE_DIR, "sessions.jsonl")
const STATE_FILE = join(STATE_DIR, "state.json")

const LEADER_SYM = Symbol.for("opencode.session-log.leader")
const PROMOTE_CHECK_MS = 15_000 // follower -> leader promotion poll
const BRANCH_TTL_MS = 30_000 // per-directory vcs.get cache
const BUSY_DEBOUNCE_MS = 250 // coalesce bursts of session.status events

interface SessionRecord {
  id: string
  title: string
  directory: string
  projectID: string
  parentID?: string
  archived: boolean
}

interface LogLine {
  ts: string
  tsMs: number
  event: "startup" | "created" | "deleted" | "archived" | "unarchived" | "busy"
  sessions: { prev: number; now: number }
  busy: { prev: number; now: number }
  children: number // busy child sessions at log time
  totalCreated: number
  session?: { id: string; title: string; parent?: string }
  project?: { id: string; directory: string; name: string }
  branch?: string | null
}

function localISO(ms: number): string {
  const d = new Date(ms)
  const p = (n: number, w = 2) => String(n).padStart(w, "0")
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? "+" : "-"
  const abs = Math.abs(off)
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}` +
    `${sign}${p(Math.floor(abs / 60))}:${p(abs % 60)}`
  )
}

export default Plugin.define({
  id: "session-log",
  async setup(ctx) {
    mkdirSync(STATE_DIR, { recursive: true })

    const token = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`
    const g = globalThis as typeof globalThis & { [LEADER_SYM]?: string }

    // claim the throne if vacant; true once this instance is the leader
    function isLeader(): boolean {
      if (g[LEADER_SYM] === token) return true
      if (g[LEADER_SYM] === undefined) {
        g[LEADER_SYM] = token
        return true
      }
      return false
    }

    const registry = new Map<string, SessionRecord>() // all known sessions, incl. children
    const total = { created: 0 }
    const prev = { live: -1, busy: -1 } // -1 = not logged yet; startup line primes them
    let disposed = false

    try {
      const st = JSON.parse(readFileSync(STATE_FILE, "utf8")) as { totalCreated?: number }
      if (typeof st.totalCreated === "number" && st.totalCreated >= 0) total.created = st.totalCreated
    } catch {
      // first run: seeded below from the current session list
    }

    const branchCache = new Map<string, { t: number; branch: string | null }>()
    async function branch(directory: string): Promise<string | null> {
      const hit = branchCache.get(directory)
      const now = Date.now()
      if (hit && now - hit.t < BRANCH_TTL_MS) return hit.branch
      let b: string | null = null
      try {
        const res = await ctx.vcs.get({ location: { directory } })
        b = res.data.branch.current ?? null
      } catch {
        b = null // not a git repo / no vcs provider
      }
      branchCache.set(directory, { t: now, branch: b })
      return b
    }

    function writeState() {
      try {
        writeFileSync(STATE_FILE, JSON.stringify({ totalCreated: total.created, updatedAt: Date.now() }))
      } catch (e) {
        console.error(`[session-log] state write failed: ${e instanceof Error ? e.message : e}`)
      }
    }

    async function write(
      event: LogLine["event"],
      opts: {
        session?: LogLine["session"]
        counts?: { live?: number; busy?: number; children?: number }
        force?: boolean
      } = {},
    ): Promise<void> {
      if (!isLeader()) return
      const liveNow = opts.counts?.live ?? prev.live
      const busyNow = opts.counts?.busy ?? prev.busy
      const children = opts.counts?.children ?? 0
      if (!opts.force && prev.live >= 0 && liveNow === prev.live && busyNow === prev.busy) return
      const now = Date.now()
      const rec = opts.session ? registry.get(opts.session.id) : undefined
      const line: LogLine = {
        ts: localISO(now),
        tsMs: now,
        event,
        sessions: { prev: prev.live < 0 ? liveNow : prev.live, now: liveNow },
        busy: { prev: prev.busy < 0 ? busyNow : prev.busy, now: busyNow },
        children,
        totalCreated: total.created,
        session: opts.session,
        project: rec
          ? { id: rec.projectID, directory: rec.directory, name: basename(rec.directory) }
          : undefined,
        branch: undefined,
      }
      prev.live = liveNow
      prev.busy = busyNow
      if (line.project) line.branch = await branch(line.project.directory)
      try {
        appendFileSync(LOG_FILE, JSON.stringify(line) + "\n")
      } catch (e) {
        console.error(`[session-log] log write failed: ${e instanceof Error ? e.message : e}`)
      }
    }

    // session status -> busy sets
    const busyTop = new Set<string>()
    const busyChild = new Set<string>()

    function isTop(id: string): boolean {
      return registry.get(id)?.parentID === undefined
    }

    let busyTimer: ReturnType<typeof setTimeout> | null = null
    // coalesce bursts of session.status events into one log line
    function scheduleBusyFlush(): void {
      if (busyTimer) clearTimeout(busyTimer)
      busyTimer = setTimeout(() => {
        busyTimer = null
        if (disposed) return
        void write("busy", {
          counts: { busy: busyTop.size, children: busyChild.size, live: prev.live },
        })
      }, BUSY_DEBOUNCE_MS)
    }

    // ---- init: rebuild registry + live set from the session list ----
    let seededTotal = false
    try {
      const res = await ctx.session.list({ limit: 1000 })
      for (const s of res.data) {
        registry.set(s.id, {
          id: s.id,
          title: s.title ?? "",
          directory: s.location.directory,
          projectID: s.projectID,
          parentID: s.parentID,
          archived: false, // list returns non-archived by default
        })
      }
      if (res.cursor.next) console.error("[session-log] session list truncated (>1000); counts self-heal via events")
      const seed = total.created === 0
      total.created = res.data.filter((s) => !s.parentID).length
      seededTotal = seed
      prev.live = res.data.filter((s) => !s.parentID).length
    } catch (e) {
      console.error(`[session-log] session.list failed: ${e instanceof Error ? e.message : e}`)
      prev.live = 0
    }
    prev.busy = 0
    if (seededTotal && isLeader()) writeState()
    await write("startup", { counts: { live: prev.live, busy: 0, children: 0 }, force: true })

    // ---- event pump ----
    const TYPES = [
      "session.created",
      "session.deleted",
      "session.archived",
      "session.unarchived",
      "session.renamed",
      "session.moved",
      "session.status",
    ] as const

    const pump = (async () => {
      try {
        const events = ctx.event.subscribe({ types: [...TYPES] })
        for await (const ev of events) {
          if (disposed) return
          try {
            const data = (ev as { data?: Record<string, unknown> }).data ?? {}
            const sessionID = typeof data.sessionID === "string" ? data.sessionID : undefined
            if (!sessionID) continue
            switch (ev.type) {
              case "session.created": {
                const rec: SessionRecord = {
                  id: sessionID,
                  title: typeof data.title === "string" && data.title ? data.title : typeof data.slug === "string" ? data.slug : "",
                  directory:
                    typeof (data.location as { directory?: unknown })?.directory === "string"
                      ? (data.location as { directory: string }).directory
                      : "",
                  projectID: typeof data.projectID === "string" ? data.projectID : "",
                  parentID: typeof data.parentID === "string" ? data.parentID : undefined,
                  archived: false,
                }
                registry.set(sessionID, rec)
                if (rec.parentID) break // children never move headline counts
                total.created += 1
                if (isLeader()) writeState()
                await write("created", {
                  session: { id: sessionID, title: rec.title || "(untitled)", parent: rec.parentID },
                  counts: { live: prev.live + 1, busy: busyTop.size, children: busyChild.size },
                })
                break
              }
              case "session.deleted": {
                const rec = registry.get(sessionID)
                registry.delete(sessionID)
                busyTop.delete(sessionID)
                busyChild.delete(sessionID)
                if (!rec || rec.parentID || rec.archived) break
                await write("deleted", {
                  session: { id: sessionID, title: rec.title || "(untitled)" },
                  counts: { live: prev.live - 1, busy: busyTop.size, children: busyChild.size },
                })
                break
              }
              case "session.archived": {
                const rec = registry.get(sessionID)
                if (rec) rec.archived = true
                if (!rec || rec.parentID) break
                await write("archived", {
                  session: { id: sessionID, title: rec.title || "(untitled)" },
                  counts: { live: prev.live - 1, busy: busyTop.size, children: busyChild.size },
                })
                break
              }
              case "session.unarchived": {
                let rec = registry.get(sessionID)
                if (!rec) {
                  try {
                    const s = await ctx.session.get({ sessionID })
                    rec = {
                      id: s.id,
                      title: s.title ?? "",
                      directory: s.location.directory,
                      projectID: s.projectID,
                      parentID: s.parentID,
                      archived: false,
                    }
                  } catch {
                    break
                  }
                }
                rec.archived = false
                registry.set(sessionID, rec)
                if (rec.parentID) break
                await write("unarchived", {
                  session: { id: sessionID, title: rec.title || "(untitled)", parent: rec.parentID },
                  counts: { live: prev.live + 1, busy: busyTop.size, children: busyChild.size },
                })
                break
              }
              case "session.renamed": {
                const rec = registry.get(sessionID)
                if (rec && typeof data.title === "string") rec.title = data.title
                break
              }
              case "session.moved": {
                const rec = registry.get(sessionID)
                if (!rec) break
                const dir = (data.location as { directory?: unknown } | undefined)?.directory
                if (typeof dir === "string") rec.directory = dir
                break
              }
              case "session.status": {
                const st = data.status as { type?: string } | undefined
                if (!st?.type) break
                const set = isTop(sessionID) ? busyTop : busyChild
                if (st.type === "busy") set.add(sessionID)
                else set.delete(sessionID)
                scheduleBusyFlush()
                break
              }
            }
          } catch (e) {
            console.error(`[session-log] event handler failed: ${e instanceof Error ? e.message : e}`)
          }
        }
      } catch (e) {
        if (!disposed) console.error(`[session-log] event pump died: ${e instanceof Error ? e.message : e}`)
      }
    })()
    void pump

    // follower promotion poll: if the leader instance got disposed (hot-reload), someone must
    // pick the writing back up even when no events flow
    const promote = setInterval(() => {
      if (disposed) return
      if (isLeader()) {
        // just became leader after a handoff; snapshot current counts so the log stays continuous
        void write("startup", { counts: { live: prev.live, busy: busyTop.size, children: busyChild.size }, force: true })
      }
    }, PROMOTE_CHECK_MS)

    return () => {
      disposed = true
      clearInterval(promote)
      if (busyTimer) clearTimeout(busyTimer)
      if (g[LEADER_SYM] === token) delete g[LEADER_SYM]
    }
  },
})
