export function clearXHandle(xHandle: string) {
  return xHandle.startsWith('@') ? xHandle.slice(1) : xHandle;
}
