import { useEffect } from 'react'
import { recordMonitoringEvent } from '../services/monitoringEventStore'

export function useExamMonitoring(onEvent) {
  useEffect(() => {
    const reportEvent = (event) => {
      const recordedEvent = recordMonitoringEvent(event)
      onEvent?.(recordedEvent)
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportEvent({
          type: 'FOCUS_LOST',
          timestamp: new Date().toISOString(),
          severity: 'warning',
          status: 'needs_review',
        })
      } else {
        reportEvent({
          type: 'FOCUS_RESTORED',
          timestamp: new Date().toISOString(),
          severity: 'info',
          status: 'logged',
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      )
    }
  }, [onEvent])
}