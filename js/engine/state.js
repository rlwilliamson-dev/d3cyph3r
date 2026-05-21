// Engine state.
//
// ES modules give us live bindings on direct imports, but importers can't
// reassign them. The setters live here so writes always go through the
// owning module.

export let currentLevelKey   = "guest@d3cyph3r";
export let currentPath       = [];   // dir parts relative to fs root
export let awaitingPassword  = null; // { target, password } or null

export function setCurrentLevelKey(k) { currentLevelKey = k; }
export function setCurrentPath(p)     { currentPath = p; }
export function resetPath()           { currentPath = []; }
export function setAwaitingPassword(v){ awaitingPassword = v; }
