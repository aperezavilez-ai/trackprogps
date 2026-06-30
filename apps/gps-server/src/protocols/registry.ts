import type { ProtocolAdapter } from './types.js'
import { TELTONIKA_PROTOCOL_ID, teltonikaAdapter } from './teltonika-adapter.js'

const adapters = new Map<string, ProtocolAdapter>()

export function registerProtocolAdapter(adapter: ProtocolAdapter): void {
  adapters.set(adapter.id, adapter)
}

registerProtocolAdapter(teltonikaAdapter)

export function getProtocolAdapter(protocolId: string | undefined): ProtocolAdapter | undefined {
  if (!protocolId) return undefined
  return adapters.get(protocolId)
}

export function getDefaultTcpProtocolAdapter(): ProtocolAdapter {
  return adapters.get(TELTONIKA_PROTOCOL_ID)!
}

export function detectTcpProtocolAdapter(buffer: Buffer): ProtocolAdapter | null {
  for (const adapter of adapters.values()) {
    if (adapter.transport !== 'tcp') continue
    if (adapter.parseHandshake(buffer)) return adapter
  }

  return null
}

export function listProtocolAdapters(): ProtocolAdapter[] {
  return [...adapters.values()]
}
