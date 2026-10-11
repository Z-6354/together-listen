/** 昵称规范化与同听键 */

function normalizeUserName(raw) {
  let s = String(raw ?? "")
    .trim()
    .replace(/[\r\n\t]/g, " ");
  if (s.length > 24) s = s.slice(0, 24);
  return s;
}

/** 同听记录键：按昵称排序，非 socket id */
function pairListenNameKey(nameA, nameB) {
  const a = normalizeUserName(nameA);
  const b = normalizeUserName(nameB);
  if (!a || !b || a === b) return null;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

module.exports = {
  normalizeUserName,
  pairListenNameKey,
};
