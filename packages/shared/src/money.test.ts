import { describe, it, expect } from 'vitest'
import { calcCommission, calcRefund, priceXaf } from './money'

describe('calcCommission', () => {
  it('splits gross into commission and net for whole percentages', () => {
    const r = calcCommission(10_000, 10)
    expect(r.commissionAmount).toBe(1000)
    expect(r.netAmount).toBe(9000)
    expect(r.percentApplied).toBe(10)
  })

  it('rounds half up to integers instead of producing fractional XAF', () => {
    expect(calcCommission(999, 15).commissionAmount).toBe(150)
    expect(calcCommission(101, 15).commissionAmount).toBe(15)
  })

  it('always conserves gross (commission + net === gross)', () => {
    for (const gross of [0, 1, 7, 123, 4567, 1_000_000]) {
      for (const percent of [0, 2.5, 12.35, 50, 100]) {
        const r = calcCommission(gross, percent)
        expect(r.commissionAmount + r.netAmount).toBe(gross)
      }
    }
  })

  it('handles zero percent and zero gross', () => {
    expect(calcCommission(5000, 0)).toEqual({
      commissionAmount: 0,
      netAmount: 5000,
      percentApplied: 0,
    })
    expect(calcCommission(0, 18)).toEqual({
      commissionAmount: 0,
      netAmount: 0,
      percentApplied: 18,
    })
  })
})

describe('calcRefund', () => {
  it('returns rounded integer refund amounts', () => {
    expect(calcRefund(10_000, 80)).toBe(8000)
    expect(calcRefund(7, 50)).toBe(4)
    expect(calcRefund(9, 50)).toBe(5)
  })

  it('returns 0 for zero percent and full amount at 100 percent', () => {
    expect(calcRefund(2500, 0)).toBe(0)
    expect(calcRefund(2500, 100)).toBe(2500)
  })
})

describe('priceXaf', () => {
  it('formats with thousands separator', () => {
    expect(priceXaf(5500)).toBe('5 500 XAF')
  })
  it('formats large numbers', () => {
    expect(priceXaf(125000)).toBe('125 000 XAF')
  })
  it('formats zero', () => {
    expect(priceXaf(0)).toBe('0 XAF')
  })
})
