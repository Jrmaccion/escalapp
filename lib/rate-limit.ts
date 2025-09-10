import { NextRequest } from 'next/server'

const rateLimitMap = new Map()

export function rateLimit(ip: string, limit: number = 10, window: number = 60000) {
  const now = Date.now()
  const windowStart = now - window
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, [])
  }
  
  const requests = rateLimitMap.get(ip)
  const requestsInWindow = requests.filter((time: number) => time > windowStart)
  
  if (requestsInWindow.length >= limit) {
    return false
  }
  
  requestsInWindow.push(now)
  rateLimitMap.set(ip, requestsInWindow)
  
  return true
}