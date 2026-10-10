import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Text } from 'react-native'
import { api } from '../api'
import type { Feedback as Rating, ViewerRole } from '../shared/types'
import { C, F } from '../theme'
import { href } from './project/parts'
import { Button, Card, H3, Row, Stars } from './ui'

export const VIEWER_ROLES: Record<ViewerRole, string> = { student: 'طالب علم', scholar: 'عالم', sheikh: 'شيخ', other: 'مشاهد' }

/** Under a finished video: how it is rated so far, and the way to the rating screen (/rate), where the form is. */
export function Feedback({ videoId, title }: { videoId: string; title?: string }) {
  const [list, setList] = useState<Rating[] | null>(null)
  useEffect(() => {
    api.feedback(videoId).then(setList, () => setList([]))
  }, [videoId])
  const average = list?.length ? list.reduce((a, f) => a + f.stars, 0) / list.length : null
  return (
    <Card>
      <H3>أعطنا رأيك في هذا الفيديو</H3>
      {average !== null && (
        <Row>
          <Stars value={Math.round(average)} size={16} />
          <Text style={{ fontFamily: F.regular, fontSize: 13, color: C.muted }}>
            {average.toFixed(1)} من {list?.length} تقييم
          </Text>
        </Row>
      )}
      <Button title="قيّم الفيديو" kind="ghost" onPress={() => router.push(href('/rate', title ? { vid: videoId, title } : { vid: videoId }))} />
    </Card>
  )
}
