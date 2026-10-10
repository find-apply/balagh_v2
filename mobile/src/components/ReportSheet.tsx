import Ionicons from '@expo/vector-icons/Ionicons'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { api, ApiError } from '@/api'
import type { ReportReason } from '@/api'
import { Sheet } from '@/components/kit'
import { Button, Notice, s } from '@/components/ui'
import { C, F } from '@/theme'

const REASONS: { key: ReportReason; label: string }[] = [
  { key: 'offensive', label: 'محتوى مسيء أو غير لائق' },
  { key: 'religious_error', label: 'خطأ شرعي في المعنى أو الحكم' },
  { key: 'wrong_text', label: 'نص شرعي غير مطابق لمصدره' },
  { key: 'other', label: 'سبب آخر' },
]

/** «أبلغ عن مشكلة» in generated content: a reason and an optional note, sent to the admin. */
export function ReportSheet({ visible, onClose, projectId, scriptId, videoId }: {
  visible: boolean
  onClose: () => void
  projectId: string
  scriptId?: string | null
  videoId?: string | null
}) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const close = () => {
    onClose()
    // Opened again later, it starts empty.
    setTimeout(() => {
      setReason(null)
      setNote('')
      setError(null)
      setSent(false)
    }, 300)
  }

  const send = async () => {
    if (!reason) return
    setBusy(true)
    setError(null)
    try {
      await api.report({ project_id: projectId, script_id: scriptId ?? null, video_id: videoId ?? null, reason, note: note.trim() })
      setSent(true)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet visible={visible} onClose={close}>
      {sent ? (
        <View style={st.done} accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={44} color={C.ok} />
          <Text style={st.title}>وصل بلاغك</Text>
          <Text style={st.sub}>تراجعه الإدارة وتتخذ ما يلزم. شكرا لحرصك.</Text>
          <Button title="تم" onPress={close} />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <Text style={st.title} accessibilityRole="header">أبلغ عن مشكلة</Text>
          <Text style={st.sub}>المحتوى مولَّد بالذكاء الاصطناعي. إن رأيت فيه ما لا يصح، أخبر الإدارة.</Text>
          <View accessibilityRole="radiogroup" style={{ gap: 6 }}>
            {REASONS.map((r) => {
              const on = reason === r.key
              return (
                <Pressable
                  key={r.key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setReason(r.key)}
                  style={[st.reason, on && st.reasonOn]}
                >
                  <View style={[st.radio, on && st.radioOn]}>{on && <View style={st.radioDot} />}</View>
                  <Text style={[st.reasonText, on && { color: C.ink, fontFamily: F.bold }]}>{r.label}</Text>
                </Pressable>
              )
            })}
          </View>
          <TextInput
            accessibilityLabel="ملاحظة (اختيارية)"
            placeholder="ملاحظة (اختيارية): أين المشكلة؟"
            placeholderTextColor="#8a938f"
            value={note}
            onChangeText={setNote}
            maxLength={1000}
            multiline
            style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
          />
          {error && <Notice tone="bad">{error}</Notice>}
          <Button title="أرسل البلاغ" onPress={() => void send()} busy={busy} disabled={!reason} />
        </View>
      )}
    </Sheet>
  )
}

const st = StyleSheet.create({
  title: { fontSize: 18, fontFamily: F.bold, color: C.ink },
  sub: { fontSize: 13, lineHeight: 21, fontFamily: F.regular, color: C.muted },
  reason: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: C.line },
  reasonOn: { borderColor: C.brand, backgroundColor: C.brandSoft },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: C.brand },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.brand },
  reasonText: { flex: 1, fontSize: 14, fontFamily: F.semibold, color: '#3d4a45' },
  done: { alignItems: 'center', gap: 10, paddingVertical: 12 },
})
