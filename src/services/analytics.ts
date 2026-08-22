type EventParameters = Record<string, string | number | boolean | undefined>

declare global {
  interface Window {
    gtag?: (command: 'event', eventName: string, parameters?: EventParameters) => void
  }
}

/** Sends an interaction event when Google Analytics is available. */
export function trackEvent(eventName: string, parameters: EventParameters = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', eventName, parameters)
}
