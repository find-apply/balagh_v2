import { initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, onIdTokenChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { useEffect, useState } from 'react'

// Accounts are Firebase's (Google, or email and password); the API checks the ID token each request carries and
// keeps the account's history. This configuration is public by design: it names the project, it grants nothing.
const app = initializeApp({
  apiKey: 'AIzaSyCGv94VZmyZzIMMkcgfGBjXJuwQRSZFrnE',
  authDomain: 'balagh-ecb5c.firebaseapp.com',
  projectId: 'balagh-ecb5c',
  storageBucket: 'balagh-ecb5c.firebasestorage.app',
  messagingSenderId: '969914896972',
  appId: '1:969914896972:web:b7cd29c0293b1a76d31ae9',
})
export const auth = getAuth(app)
auth.languageCode = 'ar'

/** The current ID token, refreshed by Firebase when it nears expiry; null for a visitor. */
export async function idToken(): Promise<string | null> {
  await auth.authStateReady()
  return auth.currentUser ? auth.currentUser.getIdToken() : null
}

/** The signed-in user, or null; undefined until Firebase has restored the session. */
export function useAccount(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  useEffect(() => onIdTokenChanged(auth, setUser), [])
  return user
}

export const signInWithGoogle = () => signInWithPopup(auth, new GoogleAuthProvider())
export const signInWithEmail = (email: string, password: string) => signInWithEmailAndPassword(auth, email, password)
export async function signUpWithEmail(name: string, email: string, password: string) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password)
  if (name.trim()) await updateProfile(user, { displayName: name.trim() })
  // the token minted at sign-up has no name yet: refresh it so the API sees the name
  await user.getIdToken(true)
  return user
}
export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email)
export const signOutNow = () => signOut(auth)

/** Firebase's error codes, in the words the rest of the site uses. */
export function authMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  const known: Record<string, string> = {
    'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة.',
    'auth/invalid-email': 'البريد الإلكتروني غير صالح.',
    'auth/user-not-found': 'لا حساب بهذا البريد.',
    'auth/wrong-password': 'كلمة المرور غير صحيحة.',
    'auth/email-already-in-use': 'هذا البريد مسجّل من قبل: سجّل الدخول به.',
    'auth/weak-password': 'كلمة المرور قصيرة: 6 أحرف على الأقل.',
    'auth/user-disabled': 'لم يُقبل هذا الحساب أو أُوقف. للاستفسار راسلنا على admin@balagh.space',
    'auth/too-many-requests': 'محاولات كثيرة. انتظر قليلا ثم أعد المحاولة.',
    'auth/popup-closed-by-user': 'أُغلقت نافذة Google قبل إتمام الدخول.',
    'auth/popup-blocked': 'المتصفح منع نافذة Google: اسمح بالنوافذ المنبثقة لهذا الموقع.',
    'auth/unauthorized-domain': 'هذا النطاق غير مأذون له في إعدادات Firebase.',
    'auth/network-request-failed': 'تعذر الاتصال. تأكد من اتصالك بالإنترنت.',
  }
  return known[code] ?? (e instanceof Error ? e.message : String(e))
}
