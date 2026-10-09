import { useEffect, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import { F } from '../theme'

/** A finished video: its cover (one of the stills the automatic check took) until it is played, then the
 * system's own player with full screen. */
export function VideoPlayer({ uri, poster, tall, seconds }: { uri: string; poster?: string | null; tall: boolean; seconds?: number | null }) {
  const [playing, setPlaying] = useState(!poster)
  const frame = { width: '100%' as const, aspectRatio: tall ? 9 / 16 : 16 / 9, maxHeight: 560, borderRadius: 12, overflow: 'hidden' as const, backgroundColor: '#0f1512' }
  if (!playing && poster)
    return (
      <Pressable accessibilityRole="button" accessibilityLabel="شغّل الفيديو" onPress={() => setPlaying(true)} style={frame}>
        <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <View style={st.play}>
          <Text style={st.icon}>▶</Text>
        </View>
        {seconds != null && <Text style={st.time}>{Math.round(seconds)} ث</Text>}
      </Pressable>
    )
  return <Playing uri={uri} style={frame} />
}

function Playing({ uri, style }: { uri: string; style: object }) {
  const player = useVideoPlayer(uri)
  useEffect(() => {
    player.play()
  }, [player])
  return <VideoView player={player} nativeControls fullscreenOptions={{ enable: true }} contentFit="contain" style={style} />
}

const st = StyleSheet.create({
  play: { position: 'absolute', top: '50%', left: '50%', width: 72, height: 72, marginTop: -36, marginLeft: -36, borderRadius: 36, backgroundColor: 'rgba(12,90,74,0.92)', alignItems: 'center', justifyContent: 'center' },
  icon: { color: '#fff', fontSize: 28, marginLeft: 4 },
  time: { position: 'absolute', bottom: 10, right: 10, color: '#fff', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, fontFamily: F.semibold, fontSize: 12, overflow: 'hidden' },
})
