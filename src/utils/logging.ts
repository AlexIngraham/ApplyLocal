export function devLog(message: string, extra?: Record<string, string | number | boolean>): void {
  if (import.meta.env.DEV) console.debug(`[ApplyLocal] ${message}`, extra ?? '')
}
