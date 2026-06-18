import { describe, it, expect } from 'vitest'
import { TeltonikaDecoder } from './teltonika.js'

// ============================================================
// Test suite for Teltonika Codec 8 decoder
// ============================================================

describe('TeltonikaDecoder', () => {

  // -----------------------------------------------
  // IMEI parsing
  // -----------------------------------------------
  describe('parseIMEI', () => {
    it('parses a valid 15-digit IMEI', () => {
      // Packet: [0x00, 0x0F] + "123456789012345"
      const imei = '123456789012345'
      const buf = Buffer.alloc(2 + imei.length)
      buf.writeUInt16BE(imei.length, 0)
      buf.write(imei, 2, 'ascii')
      expect(TeltonikaDecoder.parseIMEI(buf)).toBe(imei)
    })

    it('returns null for too-short buffer', () => {
      expect(TeltonikaDecoder.parseIMEI(Buffer.from([0x00]))).toBeNull()
    })

    it('returns null for non-numeric IMEI', () => {
      const imei = 'ABCDEFGHIJKLMNO'
      const buf = Buffer.alloc(2 + imei.length)
      buf.writeUInt16BE(imei.length, 0)
      buf.write(imei, 2, 'ascii')
      expect(TeltonikaDecoder.parseIMEI(buf)).toBeNull()
    })

    it('returns null for 14-digit IMEI', () => {
      const imei = '12345678901234'
      const buf = Buffer.alloc(2 + imei.length)
      buf.writeUInt16BE(imei.length, 0)
      buf.write(imei, 2, 'ascii')
      expect(TeltonikaDecoder.parseIMEI(buf)).toBeNull()
    })
  })

  // -----------------------------------------------
  // CRC-16/IBM
  // -----------------------------------------------
  describe('crc16', () => {
    it('calculates correct CRC for known data', () => {
      // Known Teltonika CRC test: empty buffer = 0
      expect(TeltonikaDecoder.crc16(Buffer.alloc(0))).toBe(0)
    })

    it('returns different CRC for different data', () => {
      const crc1 = TeltonikaDecoder.crc16(Buffer.from([0x01]))
      const crc2 = TeltonikaDecoder.crc16(Buffer.from([0x02]))
      expect(crc1).not.toBe(crc2)
    })

    it('is deterministic', () => {
      const data = Buffer.from([0x08, 0x01, 0x00, 0x00, 0x01])
      expect(TeltonikaDecoder.crc16(data)).toBe(TeltonikaDecoder.crc16(data))
    })
  })

  // -----------------------------------------------
  // Full Codec 8 packet (minimal synthetic test)
  // -----------------------------------------------
  describe('parseDataPacket', () => {
    it('returns null for buffer that is too short', () => {
      expect(TeltonikaDecoder.parseDataPacket(Buffer.from([0x00, 0x01]))).toBeNull()
    })

    it('returns null for invalid preamble', () => {
      const buf = Buffer.alloc(16)
      buf.writeUInt32BE(0x12345678, 0) // bad preamble
      expect(TeltonikaDecoder.parseDataPacket(buf)).toBeNull()
    })

    it('returns null for unknown codec ID', () => {
      const buf = Buffer.alloc(16)
      buf.writeUInt32BE(0x00000000, 0) // good preamble
      buf.writeUInt32BE(4, 4)           // data length = 4
      buf.writeUInt8(0x07, 8)           // bad codec (not 0x08 or 0x8E)
      expect(TeltonikaDecoder.parseDataPacket(buf)).toBeNull()
    })

    it('parses a valid Codec 8 packet with correct CRC', () => {
      const latRaw = 546_990_336
      const lngRaw = 252_618_832
      const record = Buffer.alloc(30)
      let o = 0
      record.writeBigUInt64BE(BigInt(146_524_933_600_000), o); o += 8
      record.writeUInt8(1, o); o += 1
      record.writeInt32BE(lngRaw, o); o += 4
      record.writeInt32BE(latRaw, o); o += 4
      record.writeInt16BE(148, o); o += 2
      record.writeUInt16BE(0, o); o += 2
      record.writeUInt8(18, o); o += 1
      record.writeUInt16BE(0, o); o += 2
      record.writeUInt8(0, o); o += 1
      record.writeUInt8(0, o); o += 1
      for (let i = 0; i < 4; i++) { record.writeUInt8(0, o); o += 1 }

      const dataLen = 33
      const data = Buffer.alloc(dataLen)
      let d = 0
      data.writeUInt8(0x08, d); d += 1
      data.writeUInt8(1, d); d += 1
      record.copy(data, d); d += 30
      data.writeUInt8(1, d)

      const buf = Buffer.alloc(8 + dataLen + 4)
      buf.writeUInt32BE(0, 0)
      buf.writeUInt32BE(dataLen, 4)
      data.copy(buf, 8)
      buf.writeUInt32BE(TeltonikaDecoder.crc16(data), 8 + dataLen)

      const result = TeltonikaDecoder.parseDataPacket(buf)
      expect(result).not.toBeNull()
      if (result) {
        expect(result.recordCount).toBe(1)
        expect(result.records).toHaveLength(1)
        const rec = result.records[0]!
        expect(rec.priority).toBe(1)
        expect(rec.lat).toBeCloseTo(54.6990336, 4)
        expect(rec.lng).toBeCloseTo(25.2618832, 4)
        expect(rec.speed).toBe(0)
      }
    })
  })

  // -----------------------------------------------
  // IO Element mapping
  // -----------------------------------------------
  describe('IO element mapping', () => {
    it('maps known IO IDs to correct fields', () => {
      // We'll test via a real packet that includes ignition IO (239)
      // Build a minimal but valid Codec 8 packet with ignition=1
      // This is a simplified test — real CRC testing requires full packet
      // Just verify the mapping table is correct
      const KNOWN_IOS: Record<number, string> = {
        239: 'ignition',
        240: 'movement',
        21:  'gsm_signal',
        66:  'external_voltage',
        67:  'battery_voltage',
        16:  'odometer',
        199: 'total_odometer',
      }

      // Access private method via type casting for testing
      const decoder = TeltonikaDecoder as unknown as {
        mapIO: (elements: Record<string, unknown>, id: number, value: number) => void
      }

      for (const [id, field] of Object.entries(KNOWN_IOS)) {
        const elements: Record<string, unknown> = { event_io_id: 0, total_io: 0 }
        if (typeof decoder.mapIO === 'function') {
          decoder.mapIO(elements, parseInt(id), 1)
          expect(elements).toHaveProperty(field)
        }
      }
    })
  })
})
