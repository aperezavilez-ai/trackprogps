// ============================================================
// Active TCP connections registry (by IMEI)
// ============================================================

import type net from 'node:net'

export interface DeviceConnection {
  socket: net.Socket
  imei: string
  connId: string
  connectedAt: Date
}

const byImei = new Map<string, DeviceConnection>()
const byConnId = new Map<string, DeviceConnection & { buffer: Buffer }>()

export function registerConnection(connId: string, socket: net.Socket, buffer: Buffer) {
  byConnId.set(connId, { socket, imei: '', connId, connectedAt: new Date(), buffer })
}

export function getConnState(connId: string) {
  return byConnId.get(connId)
}

export function setImei(connId: string, imei: string) {
  const conn = byConnId.get(connId)
  if (!conn) return
  conn.imei = imei
  byImei.set(imei, { socket: conn.socket, imei, connId, connectedAt: conn.connectedAt })
}

export function removeConnection(connId: string) {
  const conn = byConnId.get(connId)
  if (conn?.imei) byImei.delete(conn.imei)
  byConnId.delete(connId)
}

export function getConnectionByImei(imei: string): DeviceConnection | undefined {
  return byImei.get(imei)
}

export function getActiveImeis(): string[] {
  return [...byImei.keys()]
}

export function getConnectionCount(): number {
  return byConnId.size
}
