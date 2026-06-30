import { describe, expect, it } from 'vitest'
import { detectTcpProtocolAdapter, getProtocolAdapter, listProtocolAdapters } from './registry.js'
import { TELTONIKA_PROTOCOL_ID } from './teltonika-adapter.js'

function createTeltonikaHandshake(imei: string): Buffer {
  const buf = Buffer.alloc(2 + imei.length)
  buf.writeUInt16BE(imei.length, 0)
  buf.write(imei, 2, 'ascii')
  return buf
}

describe('protocol registry', () => {
  it('registers the Teltonika TCP adapter', () => {
    const adapter = getProtocolAdapter(TELTONIKA_PROTOCOL_ID)

    expect(adapter?.id).toBe(TELTONIKA_PROTOCOL_ID)
    expect(adapter?.transport).toBe('tcp')
    expect(listProtocolAdapters().some((item) => item.id === TELTONIKA_PROTOCOL_ID)).toBe(true)
  })

  it('detects Teltonika handshakes without coupling the TCP server to the codec', () => {
    const adapter = detectTcpProtocolAdapter(createTeltonikaHandshake('123456789012345'))
    const handshake = adapter?.parseHandshake(createTeltonikaHandshake('123456789012345'))

    expect(adapter?.id).toBe(TELTONIKA_PROTOCOL_ID)
    expect(handshake?.imei).toBe('123456789012345')
    expect(handshake?.response).toEqual(Buffer.from([0x01]))
  })

  it('returns null when no protocol adapter recognizes the payload', () => {
    const adapter = detectTcpProtocolAdapter(Buffer.from('not-a-valid-imei', 'ascii'))

    expect(adapter).toBeNull()
  })
})
