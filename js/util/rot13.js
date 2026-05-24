// ROT13 — letter-substitution cipher (A↔N, B↔O, ..., M↔Z) used in
// several crypto levels. Self-inverse: rot13(rot13(s)) === s. Non-
// letters (digits, punctuation, whitespace) pass through unchanged.
//
// Case-preserving: uppercase stays uppercase, lowercase stays lower.
// The 65 / 97 branch picks the ASCII offset of 'A' vs 'a' so the
// modular arithmetic stays within the right alphabet.
//
// The crypto command handler (`js/commands/crypto.js` → `rot13`)
// optionally overrides this output via level.rot13Out when the
// computed transform would garble the intended teaching content.
export function rot13(s) {
  return s.replace(/[a-zA-Z]/g, c => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}
