// Assemble the single COMMANDS map from per-track modules.
//
// Add new track command sets here as they're built. Two kinds of
// modules live under js/commands/:
//   - Per-track sets:  linux, network, crypto, web, forensics,
//                      osint, cloud (one file per track key).
//   - Infrastructure:  shell (help / clear / report / exit),
//                      text (wc / sort / uniq / cut / tr — pipe-
//                      friendly text utilities), and system
//                      (which / type / id / uname / date / uptime /
//                      hostname — small reflectors over engine state).
//                      These ship with the engine and are available
//                      from every level, lobby included.

import { linuxCommands }     from "./linux.js";
import { networkCommands }   from "./network.js";
import { cryptoCommands }    from "./crypto.js";
import { webCommands }       from "./web.js";
import { forensicsCommands } from "./forensics.js";
import { osintCommands }     from "./osint.js";
import { cloudCommands }     from "./cloud.js";
import { shellCommands }     from "./shell.js";
import { textCommands }      from "./text.js";
import { systemCommands }    from "./system.js";
import { sysInspectCommands } from "./sysinspect.js";
import { netInspectCommands } from "./netinspect.js";
import { formatCommands }     from "./format.js";
import { structuredCommands } from "./structured.js";
import { gitCommands }        from "./git.js";
import { readonlyStubCommands } from "./readonly-stubs.js";
import { learningCommands }  from "./learning.js";
import { envCommands }       from "./env.js";
import { jobCommands }       from "./jobs.js";

export const COMMANDS = {
  ...linuxCommands,
  ...networkCommands,
  ...cryptoCommands,
  ...webCommands,
  ...forensicsCommands,
  ...osintCommands,
  ...cloudCommands,
  ...shellCommands,
  ...textCommands,
  ...systemCommands,
  ...sysInspectCommands,
  ...netInspectCommands,
  ...formatCommands,
  ...structuredCommands,  // also overrides openssl with the multi-subcommand version
  ...gitCommands,
  ...readonlyStubCommands,
  ...learningCommands,
  ...envCommands,
  ...jobCommands,
};

// Names used by the Tab-autocomplete hint.
export const ALL_CMDS = [...Object.keys(COMMANDS), "ssh"];
