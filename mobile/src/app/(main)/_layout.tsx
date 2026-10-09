import { Stack } from 'expo-router'
import { C, F } from '@/theme'

/** The tabs at the bottom, and the screens that open over them (a new project, a project, a script). */
export default function MainLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: C.bg },
        headerTintColor: C.brand,
        headerTitleStyle: { fontFamily: F.bold, color: C.ink },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: C.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="new" options={{ title: 'مشروع جديد' }} />
      <Stack.Screen name="p/[id]/index" options={{ title: 'المشروع' }} />
      <Stack.Screen name="p/[id]/[sid]" options={{ title: 'السيناريو' }} />
    </Stack>
  )
}
