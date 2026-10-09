import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { api } from '../api'
import type { Feedback as Rating, ViewerRole } from '../shared/types'
import { Badge, Button, Card, Chip, Field, H3, Notice, P, Row, Stars } from './ui'

export const VIEWER_ROLES: Record<ViewerRole, string> = { student: 'طالب علم', scholar: 'عالم', sheikh: 'شيخ', other: 'مشاهد' }
const MIN_WORDS = 10
const KEY = 'balagh.rater'
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length

/** "Give us your opinion" under a finished video: stars, standing, name, and a remark of ten words at least. */
export function Feedback({ videoId }: { videoId: string }) {
  const [list, setList] = useState<Rating[]>([])
  const [stars, setStars] = useState(0)
  const [role, setRole] = useState<ViewerRole | null>(null)
  const [name, setName] = useState('')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    api.feedback(videoId).then(setList, () => setList([]))
    AsyncStorage.getItem(KEY).then((v) => {
      const r = v ? JSON.parse(v) : null
      if (r?.name) setName(r.name)
      if (r?.role in VIEWER_ROLES) setRole(r.role)
    }, () => undefined)
  }, [videoId])

  const count = words(comment)
  const ready = stars > 0 && role !== null && name.trim().length >= 2 && count >= MIN_WORDS
  const send = async () => {
    if (!ready || !role) return
    setBusy(true)
    setError(null)
    try {
      const f = await api.rate(videoId, { stars, role, name: name.trim(), comment: comment.trim() })
      setList((l) => [f, ...l])
      setSent(true)
      setStars(0)
      setComment('')
      void AsyncStorage.setItem(KEY, JSON.stringify({ name: name.trim(), role }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  const average = list.length ? list.reduce((a, f) => a + f.stars, 0) / list.length : null

  return (
    <Card>
      <H3>أعطنا رأيك في هذا الفيديو</H3>
      {average !== null && (
        <Row>
          <Stars value={Math.round(average)} size={16} />
          <P muted small>
            {average.toFixed(1)} من {list.length} تقييم
          </P>
        </Row>
      )}
      {sent ? (
        <>
          <Notice tone="ok">شكرا، سُجّل تقييمك.</Notice>
          <Button title="أضف تقييما آخر" kind="ghost" onPress={() => setSent(false)} />
        </>
      ) : (
        <>
          <Stars value={stars} onChange={setStars} size={34} />
          <Row>
            {(Object.keys(VIEWER_ROLES) as ViewerRole[]).map((r) => (
              <Chip key={r} label={VIEWER_ROLES[r]} on={role === r} onPress={() => setRole(r)} />
            ))}
          </Row>
          <Field label="اسمك" value={name} onChangeText={setName} maxLength={80} />
          <Field label="ملاحظتك" placeholder="ما الذي أعجبك، وما الذي يحتاج تحسينا؟" value={comment} onChangeText={setComment} maxLength={1000} multiline />
          <P small muted={count < MIN_WORDS}>{count >= MIN_WORDS ? `✓ ${count} كلمة` : `${count} من ${MIN_WORDS} كلمات على الأقل`}</P>
          {error && <Notice tone="bad">{error}</Notice>}
          <Button title="أرسل التقييم" onPress={() => void send()} disabled={!ready} busy={busy} />
        </>
      )}
      {list.slice(0, 5).map((f) => (
        <View key={f.id} style={{ gap: 4, borderTopWidth: 1, borderTopColor: '#e6e2d8', paddingTop: 8 }}>
          <Row>
            <Stars value={f.stars} size={14} />
            <P strong>{f.name}</P>
            <Badge>{VIEWER_ROLES[f.role]}</Badge>
          </Row>
          <P small muted>{f.comment}</P>
        </View>
      ))}
    </Card>
  )
}
