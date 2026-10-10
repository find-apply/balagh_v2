import Ionicons from '@expo/vector-icons/Ionicons'
import * as DocumentPicker from 'expo-document-picker'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { s } from '@/components/ui'
import { C, F } from '@/theme'

export interface SourceFile {
  uri: string
  name: string
  type: string
}

/** The source the ideas take their angles from: a YouTube link or a file, never both. */
export interface Source {
  url: string
  file: SourceFile | null
}

export const NO_SOURCE: Source = { url: '', file: null }

const MAX_BYTES = 10 * 1024 * 1024
const TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/markdown']

/** «مصدر للإلهام», as on the site: optional and folded until opened, or open while it holds a source. */
export function SourcePicker({ value, onChange, error, disabled }: { value: Source; onChange: (v: Source) => void; error?: string | null; disabled?: boolean }) {
  const has = Boolean(value.url.trim() || value.file)
  const [open, setOpen] = useState(has)
  const [pickError, setPickError] = useState<string | null>(null)

  const pick = async () => {
    setPickError(null)
    const res = await DocumentPicker.getDocumentAsync({ type: TYPES, copyToCacheDirectory: true }).catch(() => null)
    const asset = res && !res.canceled ? res.assets[0] : null
    if (!asset) return
    if (asset.size && asset.size > MAX_BYTES) {
      setPickError('الملف أكبر من 10 م.ب.')
      return
    }
    onChange({ url: '', file: { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' } })
  }

  const shown = pickError ?? error
  return (
    <View style={st.box}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        disabled={disabled}
        style={st.head}
      >
        <View style={st.icon}>
          <Ionicons name="sparkles-outline" size={17} color={C.brand} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={st.title}>
            مصدر للإلهام <Text style={st.optional}>(اختياري)</Text>
          </Text>
          <Text style={st.sub} numberOfLines={open ? undefined : 1}>
            {value.file ? `ملف: ${value.file.name}` : value.url.trim() ? 'فيديو يوتيوب' : 'محاضرة على يوتيوب، أو ملف PDF، أو صورة منشور'}
          </Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
      </Pressable>

      {open && (
        <View style={st.body}>
          <Text style={st.note}>
            يأخذ بلاغ من المصدر الزاوية والأمثلة فقط. كل نص شرعي يُتحقق منه في القرآن والصحيحين كالمعتاد؛ ما ذكره المصدر ولم يوجد فيهما يُعرض ولا يُستعمل. الملف يُقرأ مرة واحدة لهذا الطلب ثم يُحذف.
          </Text>

          {value.file ? (
            <View style={st.chosen}>
              <Ionicons name={value.file.type.startsWith('image/') ? 'image-outline' : 'document-text-outline'} size={20} color={C.brand} />
              <Text style={st.chosenText} numberOfLines={1}>
                {value.file.name}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="إزالة الملف" onPress={() => onChange(NO_SOURCE)} hitSlop={8} disabled={disabled}>
                <Ionicons name="close-circle" size={22} color={C.muted} />
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={st.label} nativeID="source-url">رابط يوتيوب (حتى 20 دقيقة)</Text>
              <TextInput
                accessibilityLabelledBy="source-url"
                accessibilityLabel="رابط يوتيوب"
                value={value.url}
                onChangeText={(url) => onChange({ url, file: null })}
                placeholder="https://www.youtube.com/watch?v=…"
                placeholderTextColor="#8a938f"
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!disabled}
                style={[s.input, st.url]}
              />
              {!value.url.trim() && (
                <>
                  <View style={st.or}>
                    <View style={st.rule} />
                    <Text style={st.orText}>أو</Text>
                    <View style={st.rule} />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void pick()}
                    disabled={disabled}
                    style={({ pressed }) => [st.pick, pressed && { opacity: 0.8 }]}
                  >
                    <Ionicons name="attach" size={18} color={C.brand} />
                    <Text style={st.pickText}>اختر ملفا: PDF، صورة، نص</Text>
                  </Pressable>
                  <Text style={st.hint}>حتى 10 م.ب</Text>
                </>
              )}
              {!!value.url.trim() && (
                <Pressable accessibilityRole="button" onPress={() => onChange(NO_SOURCE)} style={st.clear} hitSlop={6}>
                  <Text style={st.clearText}>إزالة الرابط</Text>
                </Pressable>
              )}
            </>
          )}
          {!!shown && (
            <Text style={st.error} accessibilityRole="alert">
              {shown}
            </Text>
          )}
        </View>
      )}
    </View>
  )
}

const st = StyleSheet.create({
  box: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 60 },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontFamily: F.bold, color: C.ink },
  optional: { fontFamily: F.medium, color: C.muted },
  sub: { fontSize: 12, lineHeight: 19, fontFamily: F.regular, color: C.muted },
  body: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  note: { fontSize: 12, lineHeight: 20, fontFamily: F.regular, color: '#3d4a45', backgroundColor: C.bg, borderRadius: 12, padding: 12 },
  label: { fontSize: 13, fontFamily: F.semibold, color: C.ink },
  url: { writingDirection: 'ltr', fontSize: 14 },
  or: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rule: { flex: 1, height: 1, backgroundColor: C.line },
  orText: { fontSize: 12, fontFamily: F.semibold, color: C.muted },
  pick: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: C.brand, backgroundColor: C.brandSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pickText: { fontSize: 14, fontFamily: F.semibold, color: C.brand },
  hint: { fontSize: 12, fontFamily: F.regular, color: C.muted, textAlign: 'center' },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.brandSoft },
  chosenText: { flex: 1, fontSize: 14, fontFamily: F.semibold, color: C.ink },
  clear: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center' },
  clearText: { fontSize: 13, fontFamily: F.semibold, color: C.brand },
  error: { fontSize: 13, lineHeight: 21, fontFamily: F.semibold, color: C.bad },
})
