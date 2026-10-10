import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { api, BASE } from '@/api'
import { VIEWER_ROLES } from '@/components/Feedback'
import { BigButton, Choice, Choices, p, Section } from '@/components/project/parts'
import { s, Screen } from '@/components/ui'
import { loadPrefs, setPrefs } from '@/prefs'
import type { Feedback as Rating, Video, VideoTemplate, ViewerRole } from '@/shared/types'
import { C, F } from '@/theme'

const MIN_WORDS = 10
const STAR_WORDS = ['', 'ضعيف', 'مقبول', 'جيد', 'جيد جدا', 'ممتاز']
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length
const starLine = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n)

/** Rating a finished video: stars, standing, name, and a remark of ten words at least; then the recent ratings. */
export default function Rate() {
  const { vid, title } = useLocalSearchParams<{ vid: string; title?: string }>()
  const [video, setVideo] = useState<Video | null>(null)
  const [template, setTemplate] = useState<VideoTemplate | null>(null)
  const [list, setList] = useState<Rating[]>([])
  const [stars, setStars] = useState(0)
  const [role, setRole] = useState<ViewerRole | null>(null)
  const [name, setName] = useState('')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    api.video(vid).then(
      (v) => {
        setVideo(v)
        api.templates().then((all) => setTemplate(all.find((t) => t.id === v.template) ?? null), () => undefined)
      },
      () => setVideo(null),
    )
    api.feedback(vid).then(setList, () => setList([]))
    void loadPrefs().then((pr) => {
      if (pr.raterName) setName(pr.raterName)
      if (pr.raterRole) setRole(pr.raterRole)
    })
  }, [vid])

  const count = words(comment)
  const ready = stars > 0 && role !== null && name.trim().length >= 2 && count >= MIN_WORDS
  const send = async () => {
    if (!ready || !role || busy) return
    setBusy(true)
    setError(null)
    try {
      const f = await api.rate(vid, { stars, role, name: name.trim(), comment: comment.trim() })
      setList((l) => [f, ...l])
      setSent(true)
      setStars(0)
      setComment('')
      void setPrefs({ raterName: name.trim(), raterRole: role })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  const average = list.length ? list.reduce((a, f) => a + f.stars, 0) / list.length : null
  const wide = template?.aspect === '16:9'
  const facts = [template?.name ?? video?.template, video ? (video.preview ? 'معاينة' : 'الفيديو النهائي') : null, video?.duration_seconds ? `${Math.round(video.duration_seconds)} ث` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <Screen>
      <Section style={st.summary}>
        <View style={[st.thumb, wide ? { width: 96, height: 54 } : { width: 54, height: 96 }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {video?.frames[0] ? <Image source={{ uri: BASE + video.frames[0] }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={st.summaryTitle} numberOfLines={2}>{title || template?.name || 'الفيديو'}</Text>
          {!!facts && <Text style={p.muted}>{facts}</Text>}
          {average !== null && (
            <Text style={st.average} accessibilityLabel={`المتوسط ${average.toFixed(1)} من 5، من ${list.length} تقييم`}>
              <Text style={{ color: C.gold }}>{starLine(Math.round(average))}</Text> {average.toFixed(1)} من {list.length} تقييم
            </Text>
          )}
        </View>
      </Section>

      {sent ? (
        <View style={st.sent}>
          <Text style={st.sentText} accessibilityRole="alert">شكرا، سُجّل تقييمك.</Text>
          <Pressable accessibilityRole="button" onPress={() => setSent(false)} style={({ pressed }) => [st.again, pressed && { opacity: 0.8 }]}>
            {/* An account has one rating per video: sending again replaces it. */}
            <Text style={st.againText}>عدّل تقييمك</Text>
          </Pressable>
        </View>
      ) : (
        <Section style={{ gap: 16, paddingVertical: 18 }}>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text style={st.question} accessibilityRole="header">ما رأيك في هذا الفيديو؟</Text>
            <View style={{ flexDirection: 'row', gap: 2 }} accessibilityRole="radiogroup" accessibilityLabel="عدد النجوم">
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: stars === n }}
                  accessibilityLabel={`${n} من 5، ${STAR_WORDS[n]}`}
                  onPress={() => setStars(n)}
                  style={st.star}
                >
                  <Text style={{ fontSize: 40, lineHeight: 48, color: n <= stars ? C.gold : C.lineStrong }}>★</Text>
                </Pressable>
              ))}
            </View>
            <Text style={st.starWord}>{STAR_WORDS[stars]}</Text>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={st.label}>صفتك</Text>
            <Choices radio label="صفتك">
              {(Object.keys(VIEWER_ROLES) as ViewerRole[]).map((r) => (
                <Choice key={r} radio label={VIEWER_ROLES[r]} on={role === r} onPress={() => setRole(r)} />
              ))}
            </Choices>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={st.label}>اسمك</Text>
            <TextInput accessibilityLabel="اسمك" value={name} onChangeText={setName} maxLength={80} style={[s.input, { minHeight: 48 }]} placeholderTextColor="#8a938f" />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={st.label}>ملاحظتك</Text>
            <TextInput
              accessibilityLabel="ملاحظتك"
              accessibilityHint={`${MIN_WORDS} كلمات على الأقل`}
              placeholder="ما الذي أعجبك، وما الذي يحتاج تحسينا؟"
              placeholderTextColor="#8a938f"
              value={comment}
              onChangeText={setComment}
              maxLength={1000}
              multiline
              style={[s.input, { minHeight: 110, textAlignVertical: 'top', fontSize: 15, lineHeight: 25 }]}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={st.wordBar}>
                <View style={{ height: 4, width: `${Math.min(100, count * 10)}%`, backgroundColor: count >= MIN_WORDS ? C.ok : C.muted }} />
              </View>
              <Text style={[st.wordText, { color: count >= MIN_WORDS ? C.ok : C.muted }]} accessibilityLiveRegion="polite">
                {count >= MIN_WORDS ? `✓ ${count} كلمة` : `${count} من ${MIN_WORDS} كلمات على الأقل`}
              </Text>
            </View>
          </View>

          {error && <Text style={[p.body, { color: C.bad }]} accessibilityRole="alert">{error}</Text>}
          <BigButton title={busy ? 'يرسل…' : 'أرسل التقييم'} onPress={() => void send()} disabled={!ready || busy} />
        </Section>
      )}

      {list.length > 0 && (
        <View style={{ gap: 10 }}>
          <Text style={[s.h3, { marginTop: 4 }]} accessibilityRole="header">آخر التقييمات</Text>
          {list.slice(0, 10).map((f) => (
            <View key={f.id} style={st.rating}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={{ color: C.gold, fontSize: 14, letterSpacing: 1 }} accessibilityLabel={`${f.stars} من 5`}>{starLine(f.stars)}</Text>
                <Text style={st.ratingName}>{f.name}</Text>
                <View style={st.badge}>
                  <Text style={st.badgeText}>{VIEWER_ROLES[f.role]}</Text>
                </View>
              </View>
              <Text style={p.body}>{f.comment}</Text>
            </View>
          ))}
        </View>
      )}
    </Screen>
  )
}

const st = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  thumb: { borderRadius: 10, backgroundColor: '#10241e', overflow: 'hidden' },
  summaryTitle: { fontSize: 15, fontFamily: F.bold, color: C.ink },
  average: { fontSize: 13, fontFamily: F.regular, color: '#3d4a45' },
  sent: { backgroundColor: C.okBg, borderRadius: 18, paddingVertical: 24, paddingHorizontal: 16, alignItems: 'center', gap: 10 },
  sentText: { fontSize: 17, fontFamily: F.bold, color: '#14503a', textAlign: 'center' },
  again: { minHeight: 44, paddingHorizontal: 18, borderWidth: 1, borderColor: '#b7d6c5', borderRadius: 12, backgroundColor: C.surface, justifyContent: 'center' },
  againText: { fontSize: 14, fontFamily: F.semibold, color: C.ok },
  question: { fontSize: 17, fontFamily: F.bold, color: C.ink },
  star: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  starWord: { minHeight: 20, fontSize: 13, fontFamily: F.semibold, color: '#6b4800' },
  label: { fontSize: 14, fontFamily: F.semibold, color: C.ink },
  wordBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#ebe8df', overflow: 'hidden' },
  wordText: { fontSize: 12, fontFamily: F.semibold },
  rating: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, gap: 6 },
  ratingName: { fontSize: 14, fontFamily: F.bold, color: C.ink },
  badge: { minHeight: 22, paddingHorizontal: 8, borderRadius: 11, backgroundColor: '#f0eee7', justifyContent: 'center' },
  badgeText: { fontSize: 11, fontFamily: F.semibold, color: '#3d4a45' },
})
