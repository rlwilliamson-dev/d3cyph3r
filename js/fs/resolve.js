// Resolve a file-arg against the current working directory.
//
// Many commands (base64, rot13, xxd, decode-hex, hash-id, john, xor, strings,
// exif, file) consume entries from the flat `level.files` map directly and
// don't know about the current directory. This helper rewrites a bare
// filename like "dump.dat" to "var/www/backup/dump.dat" when the user has
// `cd`'d into a subdirectory.
//
// Falls through (returns original arg) if no rewrite applies.
export function resolveFile(level, arg, currentPath) {
  if (!arg || arg.startsWith("-")) return arg;
  if (arg in level.files) return arg;
  if (!currentPath.length) return arg;
  const flatKey = currentPath.join("/") + "/" + arg;
  return flatKey in level.files ? flatKey : arg;
}
