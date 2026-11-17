// The capabilities the coordinators need from the OpenCode host. Each host generation (V1 `server`,
// V2 `setup`) implements it in its own adapter under src/host/<version>/; nothing outside src/host
// knows which SDK it runs on. Differences that cannot be papered over are part of the return values
// (`truncated`, `listSessions() === undefined`) so the coordinators know which guarantees they have.
// Deadline for plain SDK reads (transcript, session list); see util/timeout.ts.
export const SDK_READ_TIMEOUT_MS = 30_000;
