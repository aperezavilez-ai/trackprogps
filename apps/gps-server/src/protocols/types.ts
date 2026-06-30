import type net from 'node:net'
import type { TeltonikaRecord } from '@gps-saas/types'

export interface ProtocolSession {
  imei: string
  connId: string
  protocolId: string
}

export interface ParsedHandshake {
  imei: string
  bytesConsumed: number
  response?: Buffer
  metadata?: Record<string, unknown>
}

export interface ParsedDataPacket {
  records: TeltonikaRecord[]
  recordCount: number
  bytesConsumed: number
  response?: Buffer
  metadata?: Record<string, unknown>
}

export interface ProtocolAdapter {
  id: string
  name: string
  transport: 'tcp' | 'udp'
  parseHandshake(buffer: Buffer): ParsedHandshake | null
  parseDataPacket(buffer: Buffer, session: ProtocolSession): ParsedDataPacket | null
  sendCommand?(socket: net.Socket, commandText: string): boolean
}
