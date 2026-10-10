import { Stack } from 'expo-router'
import { C, F } from '@/theme'

/** The tabs at the bottom, and the screens that open over them. */
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
      <Stack.Screen name="p/[id]/[sid]" options={{ title: 'النسخة' }} />
      <Stack.Screen name="rate" options={{ title: 'قيّم الفيديو' }} />
      <Stack.Screen name="details" options={{ title: 'تفاصيل الفيديو' }} />
      <Stack.Screen name="localize" options={{ title: 'انشره لجمهور آخر' }} />
      <Stack.Screen name="profile" options={{ title: 'ملفك الشخصي' }} />
      <Stack.Screen name="delete-account" options={{ title: 'حذف الحساب' }} />
    </Stack>
  )
}
