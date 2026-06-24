// Live-move handoff guard. When a pane is moved to another window (popped out / distributed to a
// monitor), the main grid removes it — which unmounts its TerminalPane and would normally kill the
// PTY. We mark the session id here first so that unmount does NOT kill it: the session keeps running
// and the destination window renders it via session_attach (fan-out). The destination pane becomes
// the owner and kills the session when it closes.
const moving = new Set<string>();

/** Mark a session as being moved — the next unmount of its owning pane must not kill it. */
export const markMoved = (id: string): void => {
  moving.add(id);
};

/** Consume the move mark (call from onDestroy): true if it was marked (→ skip the kill). */
export const consumeMoved = (id: string): boolean => moving.delete(id);

/** Peek without consuming (so the UI can suppress the "closed — reopen?" toast for a move). */
export const peekMoved = (id: string): boolean => moving.has(id);
