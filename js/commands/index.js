// Assemble the single COMMANDS map from per-track modules.
//
// Add new track command sets here as they're built.

import { linuxCommands }     from "./linux.js";
import { networkCommands }   from "./network.js";
import { cryptoCommands }    from "./crypto.js";
import { webCommands }       from "./web.js";
import { forensicsCommands } from "./forensics.js";
import { osintCommands }     from "./osint.js";
import { cloudCommands }     from "./cloud.js";
import { shellCommands }     from "./shell.js";

export const COMMANDS = {
  ...linuxCommands,
  ...networkCommands,
  ...cryptoCommands,
  ...webCommands,
  ...forensicsCommands,
  ...osintCommands,
  ...cloudCommands,
  ...shellCommands,
};

// Names used by the Tab-autocomplete hint.
export const ALL_CMDS = [...Object.keys(COMMANDS), "ssh"];
