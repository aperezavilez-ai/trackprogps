import { describe, it, expect } from 'vitest'
import { MobileTelemetrySchema, MobileRegisterSchema } from '../schemas'

describe('MobileTelemetrySchema', () => {
  it('accepts valid batch', () => {
    const result = MobileTelemetrySchema.safeParse({
      device_uid: 'abc12345678',
      points: [{
        lat: 19.43,
        lng: -99.13,
        speed: 10,
        heading: 90,
        recorded_at: new Date().toISOString(),
      }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty batch', () => {
    const result = MobileTelemetrySchema.safeParse({
      device_uid: 'abc12345678',
      points: [],
    })
    expect(result.success).toBe(false)
  })
})

describe('MobileRegisterSchema', () => {
  it('requires platform', () => {
    const result = MobileRegisterSchema.safeParse({
      device_uid: 'device-uid-12345678',
      platform: 'android',
    })
    expect(result.success).toBe(true)
  })
})
