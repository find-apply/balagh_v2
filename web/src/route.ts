export type Route =
  | { view: 'landing' }
  | { view: 'examples' }
  | { view: 'privacy' }
  | { view: 'deleteAccount' }
  | { view: 'new' }
  | { view: 'admin'; path: string[] }
  | { view: 'project'; id: string; script: string | null }
  | { view: 'review'; id: string; script: string; role: string | null; invite: string | null }

/** Routes live in the hash: #/new, #/p/<project>, #/p/<project>/<script>, where <script> may be "new" while one is being written. */
export function parseRoute(): Route {
  // Review links from earlier versions use ?project=…&script=…; they open the same view.
  const params = new URLSearchParams(location.search)
  const shared = params.get('project')
  const hash = location.hash
  if (hash === '#/admin' || hash.startsWith('#/admin/')) return { view: 'admin', path: hash.slice(8).split('/').filter(Boolean) }
  if (hash.startsWith('#/review/')) {
    const [id, script, role, invite] = hash.slice(9).split('/')
    if (id && script) return { view: 'review', id, script, role: role || null, invite: invite || null }
  }
  if (hash.startsWith('#/p/')) {
    const [id, script] = hash.slice(4).split('/')
    return { view: 'project', id, script: script || null }
  }
  if (shared && !hash) return { view: 'project', id: shared, script: params.get('script') }
  if (hash === '#/new' || hash === '#studio') return { view: 'new' }
  if (hash === '#/examples') return { view: 'examples' }
  if (hash === '#/privacy') return { view: 'privacy' }
  if (hash === '#/delete-account') return { view: 'deleteAccount' }
  return { view: 'landing' }
}

export function go(hash: string, replace = false) {
  const url = `${location.pathname}${hash}`
  if (replace) history.replaceState(null, '', url)
  else history.pushState(null, '', url)
  dispatchEvent(new PopStateEvent('popstate'))
}

/** A reviewer's link; the invitation token after the role is what lets them sign in that role. */
export const reviewHash = (projectId: string, scriptId: string, role?: string | null, invite?: string | null) =>
  `#/review/${projectId}/${scriptId}${role ? `/${role}` : ''}${role && invite ? `/${invite}` : ''}`

export const projectHash = (id: string, script?: string | null) => `#/p/${id}${script ? `/${script}` : ''}`
