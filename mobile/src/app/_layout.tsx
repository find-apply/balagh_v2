import { AmiriQuran_400Regular } from '@expo-google-fonts/amiri-quran'
import {
  IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium, IBMPlexSansArabic_600SemiBold, IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic'
import { useFonts } from 'expo-font'
import { SplashScreen } from 'expo-router'
import { Drawer } from 'expo-router/drawer'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { HistoryDrawer } from '@/components/HistoryDrawer'
import { C } from '@/theme'

SplashScreen.preventAutoHideAsync().catch(() => undefined)

/** The side bar holds the history; everything else (the tabs and the screens above them) lives inside it. */
export default function Layout() {
  const [loaded, failed] = useFonts({
    AmiriQuran_400Regular, IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium, IBMPlexSansArabic_600SemiBold, IBMPlexSansArabic_700Bold,
  })
  useEffect(() => {
    if (loaded || failed) SplashScreen.hideAsync().catch(() => undefined)
  }, [loaded, failed])
  // Without the Qur'an font its marks would show as boxes, so the app waits for the fonts (they ship inside it).
  if (!loaded && !failed) return null
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
