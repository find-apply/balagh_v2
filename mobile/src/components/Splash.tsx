import Ionicons from '@expo/vector-icons/Ionicons'
import Constants from 'expo-constants'
import { isLoaded } from 'expo-font'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { C, F } from '@/theme'

/** Follows the system's "reduce motion" setting, so the splash stays still for those who asked for it. */
function useReduceMotion() {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    let live = true
    AccessibilityInfo.isReduceMotionEnabled().then((r) => live && setReduce(r), () => undefined)
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce)
    return () => {
      live = false
      sub.remove()
    }
  }, [])
  return reduce
}

/** The eight-pointed star of the brand's pattern: two square outlines, one turned by 45°. */
function Star({ size, color = '#fff', width = 1.2 }: { size: number; color?: string; width?: number }) {
  const square = { position: 'absolute' as const, width: size, height: size, borderWidth: width, borderColor: color }
  return (
    <View style={{ width: size, height: size }}>
      <View style={square} />
      <View style={[square, { transform: [{ rotate: '45deg' }] }]} />
    </View>
  )
}

function Dot({ delay, still }: { delay: number; still: boolean }) {
  const v = useState(() => new Animated.Value(still ? 1 : 0))[0]
  useEffect(() => {
    if (still) {
      v.setValue(1)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 480, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 480, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(300 - delay),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [v, delay, still])
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] })
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] })
  return <Animated.View style={[st.dot, { opacity, transform: [{ scale }] }]} />
}

/** What shows while the app loads its fonts and asks where the account stands. */
export function Splash() {
  const insets = useSafeAreaInsets()
  const still = useReduceMotion()
  const turn = useState(() => new Animated.Value(0))[0]
  const rise = useState(() => new Animated.Value(0))[0]
  // Before the fonts are in (the native splash still covers the screen then), the system font stands in.
  const font = (f: string) => (isLoaded(f) ? { fontFamily: f } : null)

  useEffect(() => {
    if (still) {
      rise.setValue(1)
      return
    }
    Animated.timing(rise, { toValue: 1, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }).start()
    const loop = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 60000, easing: Easing.linear, useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [still, rise, turn])

  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  const version = Constants.expoConfig?.version

  return (
    <View style={st.screen}>
      <StatusBar style="light" />
      <Animated.View pointerEvents="none" style={[st.pattern, { transform: [{ rotate }] }]}>
        <Star size={520} width={1.5} />
        <View style={st.inner}>
          <Star size={300} width={1.2} />
        </View>
      </Animated.View>
      <View pointerEvents="none" style={st.glow} />

      <Animated.View
        style={[st.body, { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}
      >
        <View style={st.logo}>
          <Ionicons name="book-outline" size={48} color="#fff" />
        </View>
        <Text style={[st.title, font(F.bold)]}>بلاغ</Text>
        <Text style={[st.tagline, font(F.regular)]}>صناعة محتوى دعوي موثَّق، بمراجعة بشرية قبل النشر.</Text>
        <View style={st.beta}>
          <Text style={[st.betaText, font(F.bold)]}>نسخة تجريبية {'⁦'}BETA{'⁩'}</Text>
        </View>
      </Animated.View>

      <View style={[st.foot, { bottom: 56 + insets.bottom }]}>
        <View style={st.dots} accessible accessibilityRole="progressbar" accessibilityLabel="يحمّل">
          <Dot delay={0} still={still} />
          <Dot delay={150} still={still} />
          <Dot delay={300} still={still} />
        </View>
        {!!version && <Text style={[st.version, font(F.regular)]}>{`⁦v${version} beta⁩`}</Text>}
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pattern: { position: 'absolute', width: 520, height: 520, alignItems: 'center', justifyContent: 'center', opacity: 0.09 },
  inner: { position: 'absolute' },
  glow: {
    position: 'absolute', width: 420, height: 420, borderRadius: 210, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  body: { alignItems: 'center', gap: 18, paddingHorizontal: 32 },
  logo: {
    width: 96, height: 96, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 56, lineHeight: 72, color: '#fff' },
  tagline: { fontSize: 16, lineHeight: 27, color: 'rgba(255,255,255,0.86)', textAlign: 'center', maxWidth: 260 },
  beta: { height: 30, paddingHorizontal: 14, borderRadius: 15, backgroundColor: '#f2d48a', justifyContent: 'center' },
  betaText: { fontSize: 13, color: '#3d2b00' },
  foot: { position: 'absolute', start: 0, end: 0, alignItems: 'center', gap: 14 },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  version: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
})
