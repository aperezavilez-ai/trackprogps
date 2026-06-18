// ============================================================
// Teltonika Codec 12 — GPRS command encoder
// https://wiki.teltonika-gps.com/view/Codec#Codec_12
// ============================================================

import { TeltonikaDecoder } from './teltonika.js'

export const COMMAND_TEXT: Record<string, string> = {
  immobilize:   'setdigout 1',
  enable:       'setdigout 0',
  get_position: 'getrecord',
  reboot:       'cpureset',
  microphone:   'call',
}

export function encodeCodec12(command: string): Buffer {
  const cmdBuf = Buffer.from(command, 'ascii')
  const cmdSize = cmdBuf.length

  // preamble(4) + dataLen(4) + codec(1) + qty1(1) + type(1) + cmdSize(4) + cmd + qty2(1) = 12 + cmdSize
  const dataFieldLength = 1 + 1 + 1 + 4 + cmdSize + 1

  const packet = Buffer.alloc(8 + dataFieldLength + 4)
  let offset = 0

  packet.writeUInt32BE(0, offset); offset += 4
  packet.writeUInt32BE(dataFieldLength, offset); offset += 4
  packet.writeUInt8(0x0C, offset); offset += 1       // Codec 12
  packet.writeUInt8(0x01, offset); offset += 1       // Command quantity 1
  packet.writeUInt8(0x05, offset); offset += 1       // Type: command
  packet.writeUInt32BE(cmdSize, offset); offset += 4
  cmdBuf.copy(packet, offset); offset += cmdSize
  packet.writeUInt8(0x01, offset); offset += 1       // Command quantity 2

  const crc = TeltonikaDecoder.crc16(packet.subarray(8, offset))
  packet.writeUInt32BE(crc, offset)

  return packet
}

export function sendCommandToSocket(socket: import('node:net').Socket, command: string): boolean {
  try {
    const packet = encodeCodec12(command)
    socket.write(packet)
    return true
  } catch (err) {
    console.error('[GPS] Failed to send command:', err)
    return false
  }
}
