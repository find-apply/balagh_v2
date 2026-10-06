/** Browser notifications for the long waits (a script in a minute, a video in several): asked for when the
 * user starts the wait, shown only if they left the tab, so the page itself stays the primary signal. */
export function askToNotify(): void {
  try {
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
  } catch {
    // Not supported (e.g. iOS Safari outside a home-screen app): the page still shows the result.
  }
}

export function notifyIfAway(title: string, body: string): void {
  try {
    if (!document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return
    const n = new Notification(title, { body, lang: 'ar', dir: 'rtl' })
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch {
    // Same as above.
  }
}
