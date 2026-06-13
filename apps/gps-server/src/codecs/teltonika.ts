// ============================================================
// Teltonika Codec 8 / 8E Decoder
// Docs: https://wiki.teltonika-gps.com/view/Codec#Codec_8
// ============================================================

import type { TeltonikaRecord, TeltonikaIOElements } from '@gps-saas/types'

// Known IO Element IDs for Teltonika FMC920
const IO_MAP: Record<number, keyof TeltonikaIOElements> = {
  239: 'ignition',
  240: 'movement',
  21:  'gsm_signal',
  24:  'speed',
  67:  'battery_voltage',
  66:  'external_voltage',
  16:  'odometer',
  199: 'total_odometer',
  69:  'gnss_status',
  181: 'gnss_pdop',
  182: 'gnss_hdop',
  200: 'sleep_mode',
}

export interface DecodedPacket {
  imei: string
  codec: 8 | 16
  records: TeltonikaRecord[]
  recordCount: number
}

export class TeltonikaDecoder {
  // Validate IMEI handshake packet
  // Format: 2 bytes length + IMEI string
  static parseIMEI(buffer: Buffer): string | null {
    if (buffer.length < 2) return null
    const imeiLen = buffer.readUInt16BE(0)
    if (buffer.length < 2 + imeiLen) return null
    const imei = buffer.subarray(2, 2 + imeiLen).toString('ascii')
    // Validate IMEI: 15 numeric digits
    if (!/^\d{15}$/.test(imei)) return null
    return imei
  }

  // Parse Codec 8 or 8E data packet
  // Returns null if invalid CRC or format
  static parseDataPacket(buffer: Buffer): DecodedPacket | null {
    try {
      if (buffer.length < 12) return null

      let offset = 0

      // 4 bytes preamble (0x00000000)
      const preamble = buffer.readUInt32BE(offset)
      if (preamble !== 0x00000000) return null
      offset += 4

      // 4 bytes data field length
      const dataLength = buffer.readUInt32BE(offset)
      offset += 4

      if (buffer.length < 8 + dataLength + 4) return null

      // 1 byte codec ID
      const codecId = buffer.readUInt8(offset)
      offset += 1

      if (codecId !== 0x08 && codecId !== 0x8E) {
        console.warn(`[GPS] Unknown codec: 0x${codecId.toString(16)}`)
        return null
      }

      const codec = codecId === 0x08 ? 8 : 16

      // 1 byte number of records
      const recordCount = buffer.readUInt8(offset)
      offset += 1

      const records: TeltonikaRecord[] = []

      for (let i = 0; i < recordCount; i++) {
        const record = codec === 8
          ? this.parseCodec8Record(buffer, offset)
          : this.parseCodec8ERecord(buffer, offset)

        if (!record) return null
        records.push(record.record)
        offset = record.nextOffset
      }

      // Verify record count at end
      const endRecordCount = buffer.readUInt8(offset)
      if (endRecordCount !== recordCount) return null
      offset += 1

      // 4 bytes CRC-16
      const expectedCRC = buffer.readUInt32BE(offset)
      const actualCRC = this.crc16(buffer.subarray(8, 8 + dataLength))

      if (expectedCRC !== actualCRC) {
        console.error(`[GPS] CRC mismatch: expected ${expectedCRC}, got ${actualCRC}`)
        return null
      }

      return {
        imei: '', // set by caller
        codec,
        records,
        recordCount,
      }
    } catch (err) {
      console.error('[GPS] Error parsing packet:', err)
      return null
    }
  }

  private static parseCodec8Record(
    buffer: Buffer,
    offset: number
  ): { record: TeltonikaRecord; nextOffset: number } | null {
    // 8 bytes timestamp (ms since epoch)
    const timestamp = new Date(Number(buffer.readBigUInt64BE(offset)))
    offset += 8

    // 1 byte priority
    const priority = buffer.readUInt8(offset) as 0 | 1 | 2
    offset += 1

    // GPS element (15 bytes)
    const lngRaw = buffer.readInt32BE(offset)
    offset += 4
    const latRaw = buffer.readInt32BE(offset)
    offset += 4
    const altitude = buffer.readInt16BE(offset)
    offset += 2
    const heading = buffer.readUInt16BE(offset)
    offset += 2
    const satellites = buffer.readUInt8(offset)
    offset += 1
    const speed = buffer.readUInt16BE(offset)
    offset += 2

    // Convert from 1/10,000,000 degrees
    const lat = latRaw / 10_000_000
    const lng = lngRaw / 10_000_000

    // IO element (Codec 8)
    const ioResult = this.parseIOElements8(buffer, offset)
    if (!ioResult) return null

    return {
      record: {
        timestamp,
        priority,
        lat,
        lng,
        altitude,
        heading,
        satellites,
        speed,
        io_elements: ioResult.elements,
      },
      nextOffset: ioResult.nextOffset,
    }
  }

  private static parseCodec8ERecord(
    buffer: Buffer,
    offset: number
  ): { record: TeltonikaRecord; nextOffset: number } | null {
    // Same structure as Codec 8 but IO element IDs are 2 bytes
    const timestamp = new Date(Number(buffer.readBigUInt64BE(offset)))
    offset += 8

    const priority = buffer.readUInt8(offset) as 0 | 1 | 2
    offset += 1

    const lngRaw = buffer.readInt32BE(offset); offset += 4
    const latRaw = buffer.readInt32BE(offset); offset += 4
    const altitude = buffer.readInt16BE(offset); offset += 2
    const heading = buffer.readUInt16BE(offset); offset += 2
    const satellites = buffer.readUInt8(offset); offset += 1
    const speed = buffer.readUInt16BE(offset); offset += 2

    const lat = latRaw / 10_000_000
    const lng = lngRaw / 10_000_000

    const ioResult = this.parseIOElements8E(buffer, offset)
    if (!ioResult) return null

    return {
      record: {
        timestamp,
        priority,
        lat,
        lng,
        altitude,
        heading,
        satellites,
        speed,
        io_elements: ioResult.elements,
      },
      nextOffset: ioResult.nextOffset,
    }
  }

  private static parseIOElements8(
    buffer: Buffer,
    offset: number
  ): { elements: TeltonikaIOElements; nextOffset: number } | null {
    const elements: TeltonikaIOElements = {
      event_io_id: buffer.readUInt8(offset),
      total_io: buffer.readUInt8(offset + 1),
    }
    offset += 2

    // 1-byte values
    const n1 = buffer.readUInt8(offset); offset += 1
    for (let i = 0; i < n1; i++) {
      const id = buffer.readUInt8(offset); offset += 1
      const val = buffer.readUInt8(offset); offset += 1
      this.mapIO(elements, id, val)
    }

    // 2-byte values
    const n2 = buffer.readUInt8(offset); offset += 1
    for (let i = 0; i < n2; i++) {
      const id = buffer.readUInt8(offset); offset += 1
      const val = buffer.readUInt16BE(offset); offset += 2
      this.mapIO(elements, id, val)
    }

    // 4-byte values
    const n4 = buffer.readUInt8(offset); offset += 1
    for (let i = 0; i < n4; i++) {
      const id = buffer.readUInt8(offset); offset += 1
      const val = buffer.readUInt32BE(offset); offset += 4
      this.mapIO(elements, id, val)
    }

    // 8-byte values
    const n8 = buffer.readUInt8(offset); offset += 1
    for (let i = 0; i < n8; i++) {
      const id = buffer.readUInt8(offset); offset += 1
      const val = Number(buffer.readBigUInt64BE(offset)); offset += 8
      this.mapIO(elements, id, val)
    }

    return { elements, nextOffset: offset }
  }

  private static parseIOElements8E(
    buffer: Buffer,
    offset: number
  ): { elements: TeltonikaIOElements; nextOffset: number } | null {
    const elements: TeltonikaIOElements = {
      event_io_id: buffer.readUInt16BE(offset),
      total_io: buffer.readUInt16BE(offset + 2),
    }
    offset += 4

    // Same as Codec 8 but IDs are 2 bytes
    for (const size of [1, 2, 4, 8] as const) {
      const count = buffer.readUInt16BE(offset); offset += 2
      for (let i = 0; i < count; i++) {
        const id = buffer.readUInt16BE(offset); offset += 2
        let val: number
        if (size === 1) { val = buffer.readUInt8(offset); offset += 1 }
        else if (size === 2) { val = buffer.readUInt16BE(offset); offset += 2 }
        else if (size === 4) { val = buffer.readUInt32BE(offset); offset += 4 }
        else { val = Number(buffer.readBigUInt64BE(offset)); offset += 8 }
        this.mapIO(elements, id, val)
      }
    }

    return { elements, nextOffset: offset }
  }

  private static mapIO(
    elements: TeltonikaIOElements,
    id: number,
    value: number
  ): void {
    const key = IO_MAP[id]
    if (key) {
      if (key === 'ignition' || key === 'movement') {
        (elements as Record<string, unknown>)[key] = value === 1
      } else {
        (elements as Record<string, unknown>)[key] = value
      }
    } else {
      // Store unknown IOs as raw
      ;(elements as Record<string, unknown>)[`io_${id}`] = value
    }
  }

  // CRC-16/IBM implementation
  static crc16(buffer: Buffer): number {
    let crc = 0
    for (const byte of buffer) {
      crc ^= byte
      for (let j = 0; j < 8; j++) {
        if (crc & 1) {
          crc = (crc >>> 1) ^ 0xA001
        } else {
          crc = crc >>> 1
        }
      }
    }
    return crc
  }
}
