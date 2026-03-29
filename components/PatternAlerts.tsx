'use client'

import { useState, useEffect } from 'react'
import { PatternAlert } from '@/app/api/patterns/route'

export default function PatternAlerts() {
  const [alerts, setAlerts] = useState<PatternAlert[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/patterns')
      .then((r) => r.json())
      .then(setAlerts)
      .catch(() => {})
  }, [])

  const visible = alerts.filter((a) => !dismissed.has(a.content))
  if (visible.length === 0) return null

  return (
    <div className="space-y-2">
      {visible.map((alert) => (
        <div
          key={alert.content}
          className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3"
        >
          <span className="text-base mt-0.5">🔁</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900">
              {alert.count}번째 반복 미완료
            </p>
            <p className="text-sm text-amber-800 mt-0.5 truncate">{alert.content}</p>
          </div>
          <button
            onClick={() => setDismissed((prev) => new Set([...prev, alert.content]))}
            className="text-amber-400 hover:text-amber-600 text-lg leading-none flex-shrink-0"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
