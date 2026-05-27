// Player-facing theme commands (v1.13.0).
//
// `themes`         list every available theme with one-line blurb +
//                  highlight the current one
// `theme`          (no arg) print the current theme + how to switch
// `theme <name>`   switch to <name> (case-insensitive)
// `theme next`     advance to the next theme in registry order
// `theme prev`     advance to the previous theme in registry order
//
// All four are infrastructure commands — available in every level
// (and the lobby), like `help` / `clear` / `progress`. The actual
// theme registry + apply logic lives in js/terminal/theme.js;
// this module just wires the command surface to it.

import { THEMES, getTheme, setTheme, cycleTheme, findTheme } from "../terminal/theme.js";

export const themeCommands = {
  /**
   * `themes` — list every theme with a one-line description.
   * Marks the current theme with a `→` arrow so the player can
   * see at a glance which one is active.
   */
  themes(_level, _arg) {
    const current = getTheme();
    const lines = [
      "Available themes (v1.13.0). Type 'theme <name>' to switch,",
      "'theme next' / 'theme prev' to cycle, or click the moon/sun",
      "icon in the top bar to advance to the next theme.",
      "",
    ];
    for (const t of THEMES) {
      const marker = t.name === current.name ? "→" : " ";
      // Pad name to 18 chars so the description column lines up.
      lines.push(`  ${marker} ${t.name.padEnd(18)} ${t.label}`);
    }
    return { text: lines.join("\n"), cls: "out" };
  },

  /**
   * `theme` / `theme <name>` / `theme next` / `theme prev`.
   * Returns success/err message; the side effect (applying the
   * theme) happens in setTheme() inside theme.js.
   */
  theme(_level, arg) {
    const trimmed = (arg || "").trim().toLowerCase();

    // No arg → status report.
    if (trimmed === "") {
      const cur = getTheme();
      return {
        text:
          `Current theme: ${cur.name} (${cur.mode} mode)\n` +
          `${cur.label}\n\n` +
          `Type 'themes' to see all available, 'theme <name>' to switch, ` +
          `or 'theme next' to cycle.`,
        cls: "info",
      };
    }

    // Cycle aliases.
    if (trimmed === "next" || trimmed === "prev" || trimmed === "previous") {
      const direction = trimmed === "next" ? 1 : -1;
      const t = cycleTheme(direction);
      return { text: `Theme: ${t.name} (${t.mode} mode) — ${t.label}`, cls: "success" };
    }

    // Direct name.
    const target = findTheme(trimmed);
    if (!target) {
      return {
        text:
          `theme: unknown theme '${trimmed}'. Type 'themes' to see ` +
          `available options.`,
        cls: "err",
      };
    }
    setTheme(target.name);
    return {
      text: `Theme: ${target.name} (${target.mode} mode) — ${target.label}`,
      cls: "success",
    };
  },
};
