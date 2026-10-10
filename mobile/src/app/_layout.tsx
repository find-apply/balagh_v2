import { AmiriQuran_400Regular } from '@expo-google-fonts/amiri-quran'
import {
  IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium, IBMPlexSansArabic_600SemiBold, IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic'
import { useFonts } from 'expo-font'
import { SplashScreen } from 'expo-router'
import { Drawer } from 'expo-router/drawer'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useAccount } from '@/account'
import { AccountGate } from '@/components/AccountGate'
import { HistoryDrawer } from '@/components/HistoryDrawer'
import { Splash } from '@/components/Splash'
import { C } from '@/theme'

SplashScreen.preventAutoHideAsync().catch(() => undefined)

/** How long the splash stays at least, from launch: long enough to be seen, even when everything loads at once. */
const SPLASH_MS = 1600

/** The side bar holds the history; everything else (the tabs and the screens above them) lives inside it. */
export default function Layout() {
  const account = useAccount()
  const [loaded, failed] = useFonts({
    AmiriQuran_400Regular, IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium, IBMPlexSansArabic_600SemiBold, IBMPlexSansArabic_700Bold,
  })
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    if (loaded || failed) SplashScreen.hideAsync().catch(() => undefined)
  }, [loaded, failed])
  useEffect(() => {
    const t = setTimeout(() => setSeen(true), SPLASH_MS)
    return () => clearTimeout(t)
  }, [])
  // Without the Qur'an font its marks would show as boxes, so the app waits for the fonts (they ship inside it).
  if (!loaded && !failed) return <Splash />
  if (account.kind === 'loading' || !seen) return <Splash />
  // The app opens only for an account the admin has approved.
  if (account.kind !== 'approved') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <AccountGate account={account} />
      </GestureHandlerRootView>
    )
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Drawer
        drawerContent={(props) => <HistoryDrawer {...props} />}
        screenOptions={{ headerShown: false, drawerStyle: { backgroundColor: C.bg, width: 300 }, swipeEdgeWidth: 40 }}
      >
        <Drawer.Screen name="(main)" />
      </Drawer>
    </GestureHandlerRootView>
  )
}
