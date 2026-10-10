import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { deleteAccount } from '@/account'
import { IconCircle } from '@/components/kit'
import { Field, Notice, Screen } from '@/components/ui'
import { writeToAdmin } from '@/contact'
import { C, F } from '@/theme'

const WORD = 'احذف'
const GONE = ['حسابك ودخولك (Google أو البريد)', 'اسمك ورقم هاتفك وتخصصك وصفتك', 'سجل مشاريعك وتقييماتك']

/** Deleting the account for good, confirmed by typing «احذف». Once deleted the device is signed out, and the
 * sign-in screen takes over. */
export default function DeleteAccount() {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = typed.trim() === WORD && !busy

  const remove = async () => {
    if (!ready) return
    setBusy(true)
    setError(null)
    try {
      await deleteAccount()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <Screen>
      <View style={st.card}>
        <View style={st.head}>
          <IconCircle icon="trash-outline" tone="bad" size={48} />
          <Text style={st.title} accessibilityRole="header">
            هل تريد حذف حسابك نهائيا؟
          </Text>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={st.strong}>يُحذف:</Text>
          {GONE.map((g) => (
            <View key={g} style={st.bullet}>
              <View style={st.dot} />
              <Text style={st.body}>{g}</Text>
            </View>
          ))}
          <Text style={[st.strong, { marginTop: 4 }]}>الأعمال المنشورة في الصفحة الرئيسية:</Text>
          <Text style={st.body}>
            تبقى منشورة دون اسمك: يظهر توقيعك «صانع محتوى» فقط، لأن مختصا راجعها والإدارة نشرتها. إن أردت حذفها أيضا،{' '}
            <Text style={st.link} onPress={() => void writeToAdmin()} accessibilityRole="link">
              تواصل مع الإدارة
            </Text>
            .
          </Text>
        </View>

        <Field
          label={`للتأكيد، اكتب «${WORD}»`}
          value={typed}
          onChangeText={setTyped}
          placeholder={WORD}
          autoCorrect={false}
          autoComplete="off"
          autoCapitalize="none"
          editable={!busy}
        />
        {error && <Notice tone="bad">{error}</Notice>}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready, busy }}
          onPress={() => void remove()}
          disabled={!ready}
          style={({ pressed }) => [st.delete, !ready && !busy && st.deleteOff, pressed && { opacity: 0.85 }]}
        >
          {busy && <ActivityIndicator color="#fff" />}
          <Text style={st.deleteText}>احذف حسابي نهائيا</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.back()} disabled={busy} style={st.cancel}>
          <Text style={st.cancelText}>إلغاء</Text>
        </Pressable>
      </View>
    </Screen>
  )
}

const st = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: '#f0c9c3', padding: 18, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, fontFamily: F.bold, fontSize: 18, lineHeight: 28, color: C.ink },
  strong: { fontFamily: F.bold, fontSize: 14, color: C.ink },
  body: { flex: 1, fontFamily: F.regular, fontSize: 14, lineHeight: 24, color: '#3d4a45' },
  link: { fontFamily: F.bold, color: C.brand, textDecorationLine: 'underline' },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingStart: 4 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#3d4a45', marginTop: 10 },
  delete: { minHeight: 52, borderRadius: 12, backgroundColor: C.bad, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteOff: { backgroundColor: '#d9a8a1' },
  deleteText: { fontFamily: F.bold, fontSize: 15, color: '#fff' },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: F.semibold, fontSize: 15, color: C.brand },
})
