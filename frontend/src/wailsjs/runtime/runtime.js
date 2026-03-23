// Mock Wails runtime — replaced by real Wails runtime at build time

const eventListeners = {}

export function EventsOn(eventName, callback) {
  if (!eventListeners[eventName]) {
    eventListeners[eventName] = []
  }
  eventListeners[eventName].push(callback)
  // Return an off function
  return () => EventsOff(eventName, callback)
}

export function EventsOff(eventName, ...callbacks) {
  if (!eventListeners[eventName]) return
  if (callbacks.length === 0) {
    delete eventListeners[eventName]
  } else {
    eventListeners[eventName] = eventListeners[eventName].filter(
      cb => !callbacks.includes(cb)
    )
  }
}

export function EventsOnce(eventName, callback) {
  const off = EventsOn(eventName, (...args) => {
    off()
    callback(...args)
  })
}

export function EventsEmit(eventName, ...args) {
  if (!eventListeners[eventName]) return
  eventListeners[eventName].forEach(cb => {
    try {
      cb(...args)
    } catch (e) {
      console.error(`Event handler error for ${eventName}:`, e)
    }
  })
}

// Simulate backend events for development
if (typeof window !== 'undefined') {
  window.__wailsRuntime = { EventsOn, EventsOff, EventsOnce, EventsEmit }

  // Simulate periodic events in dev mode
  let _roundCounter = 12
  setInterval(() => {
    _roundCounter++
    EventsEmit('monitor:status-change', {
      running: true,
      current_round: _roundCounter,
      new_comments_this_round: Math.floor(Math.random() * 15),
      total_comments: 1842 + (_roundCounter - 12) * 7,
    })
  }, 15000)
}

export function WindowMinimise() {}
export function WindowMaximise() {}
export function WindowClose() {}
export function WindowToggleMaximise() {}
export function WindowSetSize(w, h) {}
export function WindowCenter() {}
export function BrowserOpenURL(url) {
  window.open(url, '_blank')
}
export function Quit() {}
