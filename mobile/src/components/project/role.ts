import { useAccount } from '@/account'
import type { AuthorRole } from '@/shared/types'

/** The standing the admin gave this account; null until they set it. The server signs projects with it, so the
 * app only shows it and sends the same value. */
export function useRole(): { role: AuthorRole; set: boolean } {
  const account = useAccount()
  const given = 'me' in account ? account.me.role : null
  return { role: given ?? 'creator', set: given !== null }
}
