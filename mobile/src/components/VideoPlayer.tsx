import { useVideoPlayer, VideoView } from 'expo-video'

/** A finished video, with the system's own controls and full screen. */
export function VideoPlayer({ uri, tall }: { uri: string; tall: boolean }) {
  const player = useVideoPlayer(uri)
  return (
    <VideoView
      player={player}
      nativeControls
      fullscreenOptions={{ enable: true }}
      contentFit="contain"
      style={{ width: '100%', aspectRatio: tall ? 9 / 16 : 16 / 9, maxHeight: 560, borderRadius: 12, backgroundColor: '#0f1512' }}
    />
  )
}
