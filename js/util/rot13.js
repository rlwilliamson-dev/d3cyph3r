// ROT13 — letter-substitution cipher used in several crypto levels.
// Non-letters pass through unchanged.
export function rot13(s) {
  return s.replace(/[a-zA-Z]/g, c => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}
