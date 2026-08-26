/** Lodge desk. Same-tab leave target for Hunt4Food; never the in-app HashRouter home. */
export const LODGE_HOME = 'https://andrewcamero.com/'

/**
 * Full-page navigation to Base Camp. Matches the lodge LiveAppLink pattern:
 * native <a href={LODGE_HOME}> plus preventDefault + location.assign.
 * Do not use React Router Link, navigate('/'), history.back(), or goHome().
 */
export function leaveToLodge(event?: { preventDefault(): void }) {
  event?.preventDefault()
  window.location.assign(LODGE_HOME)
}

type HashWindow = {
  location: { pathname: string; search: string; hash: string }
  history: { state: unknown; replaceState: (data: unknown, unused: string, url: string) => void }
}

/**
 * HashRouter treats `/` and `/#/` as the same app, but loading `/` then pushing `#/`
 * traps Back on this origin (reload / remount). First paint must replace, not push.
 */
export function ensureHashRoute(win: HashWindow = window) {
  const { pathname, search, hash } = win.location
  if (hash && hash !== '#') return
  win.history.replaceState(win.history.state, '', `${pathname}${search}#/`)
}
