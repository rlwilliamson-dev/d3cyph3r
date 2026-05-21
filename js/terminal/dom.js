// Cache element refs once at module init so the rest of the app
// doesn't pay the document.getElementById cost per keystroke / tick.
export const termEl       = document.getElementById("terminal");
export const cmdInput     = document.getElementById("cmd-input");
export const mirrorBefore = document.getElementById("mirror-before");
export const mirrorCursor = document.getElementById("mirror-cursor");
export const mirrorAfter  = document.getElementById("mirror-after");
export const tabHint      = document.getElementById("tab-hint");
export const promptUser   = document.getElementById("prompt-user");
export const promptHost   = document.getElementById("prompt-host");
export const levelBadge   = document.getElementById("level-badge");
export const progressFill = document.getElementById("progress-fill");
export const clockEl      = document.getElementById("clock");
