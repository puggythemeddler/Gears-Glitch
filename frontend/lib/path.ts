// Read/write helpers for dotted paths into nested config objects.
// Used by the Visual Website Studio editors.

export function getAtPath(obj: any, path: string): unknown {
  let cur = obj;
  for (const part of path.split(".")) {
    if (cur == null) return undefined;
    cur = Array.isArray(cur) ? cur[Number(part)] : cur[part];
  }
  return cur;
}

export function setAtPath(obj: any, path: string, value: unknown): any {
  const [head, ...rest] = path.split(".");
  if (rest.length === 0) return { ...obj, [head]: value };
  const child = obj && obj[head];
  const nextChild = Array.isArray(child)
    ? child.map((c: any, i: number) => (String(i) === rest[0] ? setAtPath(c, rest.slice(1).join("."), value) : c))
    : child && typeof child === "object"
      ? setAtPath(child, rest.join("."), value)
      : setAtPath({}, rest.join("."), value);
  return { ...obj, [head]: nextChild };
}