'use client'

import { useReportWebVitals } from 'next/web-vitals'
import { reportWebVitals } from '@/lib/analytics'

export function WebVitals() {
  useReportWebVitals(reportWebVitals)
  return null
}
