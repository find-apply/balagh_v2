import AsyncStorage from '@react-native-async-storage/async-storage'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import { initializeApp } from 'firebase/app'
import { getReactNativePersistence, initializeAuth } from 'firebase/auth'
import type { Persistence, ReactNativeAsyncStorage } from 'firebase/auth'

// Metro loads Firebase's React Native build, which has this; the published typings are the browser build's.
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence
}

// The same Firebase project as the site; this configuration is public by design: it names the project, it grants
// nothing. The API checks each request's ID token against Google's public keys.
const app = initializeApp({
  apiKey: 'AIzaSyCGv94VZmyZzIMMkcgfGBjXJuwQRSZFrnE',
  authDomain: 'balagh-ecb5c.firebaseapp.com',
  projectId: 'balagh-ecb5c',
  storageBucket: 'balagh-ecb5c.firebasestorage.app',
  messagingSenderId: '969914896972',
  appId: '1:969914896972:web:b7cd29c0293b1a76d31ae9',
})
export const auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
auth.languageCode = 'ar'

// Google signs in natively and hands over an ID token minted for the project's web client, which Firebase accepts.
GoogleSignin.configure({ webClientId: '969914896972-rsf98r5mu80q1stu4mosik9ekr862tvg.apps.googleusercontent.com' })

/** The current ID token, refreshed by Firebase when it nears expiry; null when signed out. */
export async function idToken(): Promise<string | null> {
  await auth.authStateReady()
  return auth.currentUser ? auth.currentUser.getIdToken() : null
}
