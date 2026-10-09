import { AmiriQuran_400Regular } from '@expo-google-fonts/amiri-quran'
import {
  IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium, IBMPlexSansArabic_600SemiBold, IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic'
import { useFonts } from 'expo-font'
import { SplashScreen, Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { C, F } from '../theme'

SplashScreen.preventAutoHideAsync().catch(() => undefined)

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
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerTintColor: C.brand,
          headerTitleStyle: { fontFamily: F.bold, color: C.ink },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'بلاغ' }} />
        <Stack.Screen name="new" options={{ title: 'مشروع جديد' }} />
        <Stack.Screen name="p/[id]/index" options={{ title: 'المشروع' }} />
        <Stack.Screen name="p/[id]/[sid]" options={{ title: 'السيناريو' }} />
      </Stack>
    </>
  )
}
