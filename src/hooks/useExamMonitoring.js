import { useEffect } from 'react'
import { getCandidateId, recordMonitoringEvent, startMonitoringSession } from '../services/monitoringEventStore'

export function useExamMonitoring(onEvent) {
  useEffect(() => {
    startMonitoringSession()
    const candidateId = getCandidateId()
    const reportEvent = (event) => {
      recordMonitoringEvent(event).then((recordedEvent) => {
        onEvent?.(recordedEvent)
      }).catch((error) => {
        console.error('Exam monitoring event could not be saved to the demo server.', error)
      })
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