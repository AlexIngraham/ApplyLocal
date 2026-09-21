import { startController } from '@/content/controller'

const scope = globalThis as typeof globalThis & { __APPLYLOCAL_BOOTED__?: boolean }
if (!scope.__APPLYLOCAL_BOOTED__) {
  scope.__APPLYLOCAL_BOOTED__ = true
  startController(document, window)
}
