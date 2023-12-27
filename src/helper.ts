export function isObject(v: unknown): v is Record<string, any> {
  return Object.prototype.toString.call(v) === "[object Object]"
}
