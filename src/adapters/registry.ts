import type { Settings } from '@/settings/types'
import type { ATSAdapter } from '@/adapters/types'
import { genericAdapter } from '@/adapters/generic'
import { greenhouseAdapter } from '@/adapters/greenhouse'
import { leverAdapter } from '@/adapters/lever'

const SITE_ADAPTERS = [greenhouseAdapter, leverAdapter]

export function selectAdapter(url: string, root: ParentNode, settings: Settings): ATSAdapter {
  if (!settings.enableSiteAdapters) return genericAdapter
  const byUrl = SITE_ADAPTERS.find((adapter) => adapter.matches(url))
  if (byUrl) return byUrl
  const byDom = SITE_ADAPTERS.find((adapter) => adapter.detectDom?.(root))
  return byDom ?? genericAdapter
}

export function getAdapter(id: string): ATSAdapter {
  return [...SITE_ADAPTERS, genericAdapter].find((adapter) => adapter.id === id) ?? genericAdapter
}

export { genericAdapter, greenhouseAdapter, leverAdapter }
