import Ionicons from '@expo/vector-icons/Ionicons'
import { DrawerActions } from 'expo-router/react-navigation'
import { Tabs, useNavigation } from 'expo-router'
import { useEffect } from 'react'
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native'
import { BetaBadge } from '@/components/kit'
import { refreshLibrary, useLibrary, useUnseen } from '@/components/tabs/libraryFeed'
import { C, F } from '@/theme'

/** The button that opens the history side bar, in every tab's header. */
function HistoryButton() {
  const nav = useNavigation()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="السجل"
      onPress={() => nav.dispatch(DrawerActions.openDrawer())}
      style={({ pressed }) => [st.menu, pressed && { backgroundColor: C.brandSoft }]}
    >
      <Ionicons name="menu" size={26} color={C.brand} />
    </Pressable>
  )
}

function HomeTitle() {
  return (
    <View style={st.title} accessibilityRole="header">
      <Text style={st.titleText}>بلاغ</Text>
      <BetaBadge />
    </View>
  )
}

/** How many videos the library holds, beside its title. */
function LibraryCount() {
  const { items } = useLibrary()
  if (!items?.length) return null
  return <Text style={st.count}>{items.length === 1 ? 'فيديو واحد' : items.length === 2 ? 'فيديوهان' : `${items.length} فيديوهات`}</Text>
}

// Videos finish while the app is open or away; the count of new ones is checked now and then.
const POLL_MS = 60_000

/** The footer: home, the library of generated videos (with how many are new), and settings. */
export default function TabsLayout() {
  const unseen = useUnseen().size

  useEffect(() => {
    void refreshLibrary()
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refreshLibrary()
    }, POLL_MS)
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refreshLibrary()
    })
    return () => {
      clearInterval(timer)
      sub.remove()
    }
  }, [])

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: C.bg },
        headerTitleStyle: { fontFamily: F.bold, color: C.ink, fontSize: 22 },
        headerTitleAlign: 'left',
        headerShadowVisible: false,
        headerLeft: () => <HistoryButton />,
        tabBarActiveTintColor: C.brand,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontFamily: F.semibold, fontSize: 12 },
        tabBarStyle: { backgroundColor: C.surface, borderTopColor: C.line, height: 64, paddingTop: 6 },
        sceneStyle: { backgroundColor: C.bg },
      }}
      screenListeners={{ focus: () => void refreshLibrary() }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'الرئيسية',
          headerTitle: () => <HomeTitle />,
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'المكتبة',
          headerRight: () => <LibraryCount />,
          tabBarBadge: unseen > 0 ? unseen : undefined,
          tabBarBadgeStyle: st.badge,
          tabBarAccessibilityLabel: unseen > 0 ? `المكتبة، ${unseen} ${unseen === 1 ? 'فيديو جديد' : 'فيديوهات جديدة'}` : 'المكتبة',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'play-circle' : 'play-circle-outline'} size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'الإعدادات', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'settings' : 'settings-outline'} size={24} color={color} /> }}
      />
    </Tabs>
  )
}

const st = StyleSheet.create({
  menu: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginHorizontal: 8 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleText: { fontFamily: F.bold, fontSize: 22, color: C.ink },
  count: { fontFamily: F.regular, fontSize: 13, color: C.muted, paddingHorizontal: 16 },
  badge: { backgroundColor: C.bad, color: '#fff', fontFamily: F.bold, fontSize: 11 },
})
