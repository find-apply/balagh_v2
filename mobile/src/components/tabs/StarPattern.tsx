import { StyleSheet, View } from 'react-native'

const CELL = 56
const SQUARE = 20
const COLS = 8
const ROWS = 6

/** The eight-pointed stars behind the green cards: two squares, one turned a quarter, on a 56px grid. Drawn
 * with plain views (the app has no SVG), clipped by the card. */
export function StarPattern({ opacity = 0.12 }: { opacity?: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity, overflow: 'hidden' }]} importantForAccessibility="no-hide-descendants">
      {Array.from({ length: ROWS * COLS }, (_, i) => {
        const left = (i % COLS) * CELL + (CELL - SQUARE) / 2
        const top = Math.floor(i / COLS) * CELL + (CELL - SQUARE) / 2
        return (
          <View key={i} style={{ position: 'absolute', left, top, width: SQUARE, height: SQUARE }}>
            <View style={st.square} />
            <View style={[st.square, { transform: [{ rotate: '45deg' }] }]} />
          </View>
        )
      })}
    </View>
  )
}

const st = StyleSheet.create({
  square: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderWidth: 1.2, borderColor: '#ffffff' },
})
