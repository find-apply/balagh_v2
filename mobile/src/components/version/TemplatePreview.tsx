import Ionicons from '@expo/vector-icons/Ionicons'
import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { F } from '@/theme'
import { useReduceMotion } from './common'

/** One line a preview shows; a quote is set in gold, as the videos set the verified text. */
export interface PreviewLine {
  text: string
  quote?: boolean
}

const GOLD = '#f2d48a'

/** A silent, approximate preview of a template drawn on the phone: no audio, no render. */
export function TemplatePreview({ template, lines, size = 'card', delay = 0, wide, style }: {
  template: string
  lines: PreviewLine[]
  size?: 'card' | 'scene'
  delay?: number
  wide?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const frame = [st.frame, { aspectRatio: wide ? 16 / 9 : 9 / 16, borderRadius: size === 'card' ? 16 : 12 }, style]
  if (template === 'geo') return <GeoPreview lines={lines} size={size} delay={delay} style={frame} />
  if (template === 'captions') return <CaptionsPreview lines={lines} size={size} delay={delay} style={frame} />
  return <GenericPreview lines={lines} size={size} delay={delay} style={frame} />
}

/** The cycle's clock: 0 → 1 over `ms`, again and again, unless motion is reduced. */
function useCycle(ms: number, delay: number, onLoop?: () => void) {
  const reduce = useReduceMotion()
  const [t] = useState(() => new Animated.Value(0))
  const loopRef = useRef(onLoop)
  useEffect(() => {
    loopRef.current = onLoop
  })
  useEffect(() => {
    if (reduce) {
      t.setValue(0.5)
      return
    }
    let stopped = false
    let anim: Animated.CompositeAnimation | null = null
    const go = (wait: number) => {
      t.setValue(0)
      anim = Animated.sequence([Animated.delay(wait), Animated.timing(t, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: true })])
      anim.start(({ finished }) => {
        if (!finished || stopped) return
        loopRef.current?.()
        go(0)
      })
    }
    go(delay)
    return () => {
      stopped = true
      anim?.stop()
    }
  }, [reduce, ms, delay, t])
  return { t, reduce }
}

function Caption({ line, size }: { line: PreviewLine; size: 'card' | 'scene' }) {
  const fontSize = size === 'card' ? (line.quote ? 14 : 16) : line.quote ? 11 : 12
  const words = line.text.split(' ')
  const last = !line.quote && words.length > 1 ? words.pop() : null
  return (
    <Text numberOfLines={size === 'card' ? 5 : 6} style={[st.caption, { fontSize, lineHeight: fontSize * 1.7, color: line.quote ? GOLD : '#fff' }]}>
      {words.join(' ')}
      {last ? <Text style={{ color: GOLD }}> {last}</Text> : null}
    </Text>
  )
}

/** The bar along the bottom that fills over the cycle, as a playing video's would. */
function Bar({ t }: { t: Animated.Value }) {
  return (
    <View style={st.track}>
      <Animated.View style={[st.fill, { transform: [{ scaleX: t }] }]} />
    </View>
  )
}

function Muted({ size }: { size: 'card' | 'scene' }) {
  if (size !== 'card') return null
  return (
    <View style={st.muted}>
      <Ionicons name="volume-mute" size={15} color="#fff" />
    </View>
  )
}

/** captions: the script's lines one after another, rising in and fading out over a dark green frame. */
function CaptionsPreview({ lines, size, delay, style }: { lines: PreviewLine[]; size: 'card' | 'scene'; delay: number; style: StyleProp<ViewStyle> }) {
  const [i, setI] = useState(0)
  const { t, reduce } = useCycle(size === 'card' ? 2400 : 4000, delay, () => setI((n) => (lines.length ? (n + 1) % lines.length : 0)))
  const line = lines[i % Math.max(1, lines.length)]
  const opacity = reduce ? 1 : t.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] })
  const translateY = reduce ? 0 : t.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [10, 0, 0, -8] })
  return (
    <View style={[style, { backgroundColor: '#10241e' }]}>
      <View style={[st.glow, { backgroundColor: '#1d4a3e' }]} />
      {line && (
        <Animated.View style={[st.captionBox, { bottom: line.quote ? '30%' : '34%', opacity, transform: [{ translateY }] }]}>
          <Caption line={line} size={size} />
        </Animated.View>
      )}
      <Bar t={t} />
      <Muted size={size} />
    </View>
  )
}

/** An eight-point star: two squares, one turned by 45 degrees. */
function Star({ size, color, width = 1 }: { size: number; color: string; width?: number }) {
  const sq = { position: 'absolute' as const, width: size, height: size, borderWidth: width, borderColor: color }
  return (
    <View style={{ width: size, height: size }}>
      <View style={sq} />
      <View style={[sq, { transform: [{ rotate: '45deg' }] }]} />
    </View>
  )
}

/** geo: a slowly turning eight-point star, a breathing centre, and the verified text fading in and out. */
function GeoPreview({ lines, size, delay, style }: { lines: PreviewLine[]; size: 'card' | 'scene'; delay: number; style: StyleProp<ViewStyle> }) {
  const [i, setI] = useState(0)
  const { t, reduce } = useCycle(6000, delay, () => setI((n) => (lines.length ? (n + 1) % lines.length : 0)))
  const [spin] = useState(() => new Animated.Value(0))
  useEffect(() => {
    if (reduce) return
    const a = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 24000, easing: Easing.linear, useNativeDriver: true }))
    a.start()
    return () => a.stop()
  }, [reduce, spin])
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  const scale = reduce ? 1 : t.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [1, 1.08, 1, 1.08] })
  const opacity = reduce ? 1 : t.interpolate({ inputRange: [0, 0.1, 0.25, 0.8, 0.95, 1], outputRange: [0, 0, 1, 1, 0, 0] })
  const line = lines[i % Math.max(1, lines.length)]
  const big = size === 'card' ? 150 : 90
  const small = size === 'card' ? 46 : 28
  return (
    <View style={[style, { backgroundColor: '#1b1a2e', alignItems: 'center' }]}>
      <Animated.View style={[st.center, { opacity: 0.35, transform: [{ rotate }] }]}>
        <Star size={big} color="#d9b65f" />
      </Animated.View>
      <Animated.View style={[st.center, { transform: [{ scale }] }]}>
        <Star size={small} color="#d9b65f" width={2} />
      </Animated.View>
      {line && (
        <Animated.View style={[st.captionBox, { bottom: '22%', opacity }]}>
          <Text numberOfLines={size === 'card' ? 5 : 6} style={[st.caption, { color: '#fff', fontSize: size === 'card' ? 14 : 11, lineHeight: size === 'card' ? 25 : 19 }]}>
            {line.text}
          </Text>
        </Animated.View>
      )}
      <Bar t={t} />
      <Muted size={size} />
    </View>
  )
}

/** Any other template: a pulsing play mark and the lines fading through. */
function GenericPreview({ lines, size, delay, style }: { lines: PreviewLine[]; size: 'card' | 'scene'; delay: number; style: StyleProp<ViewStyle> }) {
  const [i, setI] = useState(0)
  const { t, reduce } = useCycle(3000, delay, () => setI((n) => (lines.length ? (n + 1) % lines.length : 0)))
  const line = lines[i % Math.max(1, lines.length)]
  const opacity = reduce ? 1 : t.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] })
  const scale = reduce ? 1 : t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.1, 1] })
  return (
    <View style={[style, { backgroundColor: '#14201c' }]}>
      <Animated.View style={[st.center, { transform: [{ scale }] }]}>
        <Ionicons name="play-circle-outline" size={size === 'card' ? 44 : 28} color="rgba(255,255,255,0.5)" />
      </Animated.View>
      {line && (
        <Animated.View style={[st.captionBox, { bottom: '20%', opacity }]}>
          <Caption line={line} size={size} />
        </Animated.View>
      )}
      <Bar t={t} />
      <Muted size={size} />
    </View>
  )
}

const st = StyleSheet.create({
  frame: { width: '100%', overflow: 'hidden', position: 'relative' },
  glow: { position: 'absolute', width: '140%', aspectRatio: 1, borderRadius: 999, top: '-10%', alignSelf: 'center', opacity: 0.55 },
  captionBox: { position: 'absolute', start: 8, end: 8 },
  caption: { fontFamily: F.bold, textAlign: 'center' },
  center: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center' },
  track: { position: 'absolute', bottom: 7, start: 7, end: 7, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  fill: { height: 3, width: '100%', backgroundColor: '#fff', transformOrigin: 'right' },
  muted: { position: 'absolute', top: 8, end: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
})
