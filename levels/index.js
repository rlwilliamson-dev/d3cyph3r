// Level registry. New tracks register here.
//
// LEVELS is keyed by "<user>@<host>" — e.g., "level3@crypto" — matching
// the SSH-style level switching UX. The "guest@d3cyph3r" entry is the
// lobby where the user lands at boot and returns to after completing tracks.

import { initLevels } from "../js/fs/flatten.js";
import { linuxLevels }   from "./linux.js";
import { networkLevels } from "./network.js";
import { cryptoLevels }  from "./crypto.js";

export const LEVELS = initLevels({
  // ── Lobby ────────────────────────────────────────────────────
  "guest@d3cyph3r": {
    password: null,
    track: null,
    objective: null,
    files: {},
    isLobby: true,
  },

  // ── Tracks ───────────────────────────────────────────────────
  ...linuxLevels,
  ...networkLevels,
  ...cryptoLevels,
});
