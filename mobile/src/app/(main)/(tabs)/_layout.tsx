import Ionicons from '@expo/vector-icons/Ionicons'
import { DrawerActions } from 'expo-router/react-navigation'
import { Tabs, useNavigation } from 'expo-router'
import { Pressable } from 'react-native'
import { C, F } from '@/theme'

/** The button that opens the history side bar, in every tab's header. */
function HistoryButton() {
  const nav = useNavigation()
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="السجل" hitSlop={10} onPress={() => nav.dispatch(DrawerActions.openDrawer())} style={{ paddingHorizontal: 16 }}>
      <Ionicons name="menu" size={26} color={C.brand} />
    </Pressable>
  )
}

/** The footer: home, the library of generated videos, and settings. */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: C.bg },
        headerTitleStyle: { fontFamily: F.bold, color: C.ink },
        headerShadowVisible: false,
        headerLeft: () => <HistoryButton />,
        tabBarActiveTintColor: C.brand,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontFamily: F.semibold, fontSize: 12 },
        tabBarStyle: { backgroundColor: C.surface, borderTopColor: C.line, height: 64, paddingTop: 6 },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'الرئيسية', headerTitle: 'بلاغ', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} /> }} />
      <Tabs.Screen name="library" options={{ title: 'المكتبة', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'play-circle' : 'play-circle-outline'} size={26} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'الإعدادات', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'settings' : 'settings-outline'} size={24} color={color} /> }} />
    </Tabs>
  )
}
