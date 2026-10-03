import { useEffect } from 'react'
import { getCandidateId, recordMonitoringEvent } from '../services/monitoringEventStore'

export function useExamMonitoring(onEvent) {
  useEffect(() => {
    const candidateId = getCandidateId()
    const reportEvent = (event) => {
      const recordedEvent = recordMonitoringEvent(event)
      onEvent?.(recordedEvent)
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportEvent({
          candidateId,
          type: 'FOCUS_LOST',
          timestamp: new Date().toISOString(),
          severity: 'warning',
          status: 'needs_review',
        })
      } else {
        reportEvent({
          candidateId,
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