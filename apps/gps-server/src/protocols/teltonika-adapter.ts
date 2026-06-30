import type net from 'node:net'
import { TeltonikaDecoder } from '../codecs/teltonika.js'
import { sendCommandToSocket } from '../codecs/teltonika-commands.js'
import type {
  ParsedDataPacket,
  ParsedHandshake,
  ProtocolAdapter,
  ProtocolSession,
} from './types.js'

export const TELTONIKA_PROTOCOL_ID = 'teltonika-codec8'

export const teltonikaAdapter: ProtocolAdapter = {
  id: TELTONIKA_PROTOCOL_ID,
  name: 'Teltonika Codec 8/8E',
  transport: 'tcp',

  parseHandshake(buffer: Buffer): ParsedHandshake | null {
    const imei = TeltonikaDecoder.parseIMEI(buffer)
    if (!imei) return null

    return {
      imei,
      bytesConsumed: 2 + imei.length,
      response: Buffer.from([0x01]),
    }
  },

  parseDataPacket(buffer: Buffer, _session: ProtocolSession): ParsedDataPacket | null {
    const packet = TeltonikaDecoder.parseDataPacket(buffer)
    if (!packet) return null

    const ack = Buffer.alloc(4)
    ack.writeUInt32BE(packet.recordCount, 0)

    const dataLength = buffer.readUInt32BE(4)

    return {
      records: packet.records,
      recordCount: packet.recordCount,
      bytesConsumed: 8 + dataLength + 4,
      response: ack,
      metadata: {
        codec: packet.codec,
      },
    }
  },

  sendCommand(socket: net.Socket, commandText: string): boolean {
    return sendCommandToSocket(socket, commandText)
  },
}
