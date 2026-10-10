import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin'
import {
  createUserWithEmailAndPassword, GoogleAuthProvider, onIdTokenChanged, sendPasswordResetEmail, signInWithCredential,
  signInWithEmailAndPassword, signOut, updateProfile,
} from 'firebase/auth'
import { useSyncExternalStore } from 'react'
import { api, ApiError } from './api'
import type { Me, Profile } from './api'
import { auth } from './firebase'

/** Where the person stands: the app opens only for an approved account. */
export type Account =
  | { kind: 'loading' }
  | { kind: 'signedOut' }
  | { kind: 'unreachable'; message: string }
  | { kind: 'profile'; me: Me } // signed in, sign-up details not given yet
  | { kind: 'pending'; me: Me }
  | { kind: 'rejected'; me: Me }
  | { kind: 'approved'; me: Me }

let current: Account = { kind: 'loading' }
const listeners = new Set<() => void>()

function set(a: Account) {
  current = a
  listeners.forEach((l) => l())
}

const complete = (me: Me) => Boolean(me.full_name && me.specialization && me.phone)

function fromMe(me: Me): Account {
  if (me.status === 'approved') return { kind: 'approved', me }
  if (me.status === 'rejected') return { kind: 'rejected', me }
  return complete(me) ? { kind: 'pending', me } : { kind: 'profile', me }
}

// Sign-up details given with an email and password, before the account exists: sent with the first /me, and kept
// until the server has them, so a dropped connection does not lose them.
let waiting: Profile | null = null

/** Asks the server where the account stands, sending the sign-up details when given. */
export async function refresh(profile?: Profile): Promise<void> {
  if (!auth.currentUser) return set({ kind: 'signedOut' })
  const given = profile ?? waiting ?? undefined
  try {
    set(fromMe(await api.me(given)))
    waiting = null
  } catch (e) {
    // A refused profile goes back to the form, with the server's words; anything else is a connection problem.
    if (given && e instanceof ApiError && e.status === 422) {
      waiting = null
      if (profile) throw e
      return refresh()
    }
    set({ kind: 'unreachable', message: e instanceof Error ? e.message : String(e) })
  }
}

onIdTokenChanged(auth, (user) => {
  // A refreshed token for the same account changes nothing; only signing in or out does.
  if (!user) set({ kind: 'signedOut' })
  else if (current.kind === 'loading' || current.kind === 'signedOut') void refresh()
})

export async function signInWithGoogle(): Promise<void> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
  const res = await GoogleSignin.signIn()
  if (!isSuccessResponse(res)) return // the person closed Google's sheet
  const token = res.data.idToken
  if (!token) throw new Error('لم يُرجع Google رمز الدخول.')
  await signInWithCredential(auth, GoogleAuthProvider.credential(token))
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), password)
}

/** Creates the account with its sign-up details; like any new account, it then waits for the admin. */
export async function signUpWithEmail(email: string, password: string, profile: Profile): Promise<void> {
  waiting = profile
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password)
    await updateProfile(user, { displayName: profile.full_name }).catch(() => undefined)
  } catch (e) {
    waiting = null
    throw e
  }
}

export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email.trim())

/** Saves corrected details of an approved account and keeps the app's copy in step. */
export async function saveProfile(profile: Profile): Promise<Me> {
  const me = await api.updateProfile(profile)
  set(fromMe(me))
  return me
}

/** Deletes the account on the server (and its Firebase sign-in), then signs this device out. */
export async function deleteAccount(): Promise<void> {
  await api.deleteMe()
  await signOutNow().catch(() => undefined)
}

export async function signOutNow(): Promise<void> {
  waiting = null
  await GoogleSignin.signOut().catch(() => undefined)
  await signOut(auth)
}

/** Google's and Firebase's errors, in the app's words; null when the person simply cancelled. */
export function signInMessage(e: unknown): string | null {
  if (isErrorWithCode(e)) {
    switch (e.code) {
      case statusCodes.SIGN_IN_CANCELLED:
        return null
      case statusCodes.IN_PROGRESS:
        return 'الدخول جارٍ بالفعل.'
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return 'خدمات Google Play غير متوفرة أو تحتاج تحديثا على هذا الجهاز.'
      case '10':
      case 'DEVELOPER_ERROR':
        return 'إعداد الدخول بـ Google غير مكتمل لهذه النسخة من التطبيق (بصمة SHA-1 غير مسجلة في Firebase).'
    }
  }
  const code = (e as { code?: string })?.code ?? ''
  const known: Record<string, string> = {
    'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة.',
    'auth/invalid-email': 'البريد الإلكتروني غير صالح.',
    'auth/missing-email': 'اكتب بريدك الإلكتروني.',
    'auth/user-not-found': 'لا حساب بهذا البريد.',
    'auth/wrong-password': 'كلمة المرور غير صحيحة.',
    'auth/missing-password': 'اكتب كلمة المرور.',
    'auth/email-already-in-use': 'هذا البريد مسجّل من قبل: سجّل الدخول به.',
    'auth/weak-password': 'كلمة المرور قصيرة: 6 أحرف على الأقل.',
    'auth/operation-not-allowed': 'الدخول بالبريد غير مفعّل في إعدادات Firebase.',
    'auth/network-request-failed': 'تعذر الاتصال. تأكد من اتصالك بالإنترنت.',
    'auth/too-many-requests': 'محاولات كثيرة. انتظر قليلا ثم أعد المحاولة.',
    'auth/user-disabled': 'لم يُقبل هذا الحساب أو أُوقف. للاستفسار راسلنا على admin@balagh.space',
  }
  return known[code] ?? (e instanceof Error ? e.message : String(e))
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export const useAccount = (): Account => useSyncExternalStore(subscribe, () => current)
