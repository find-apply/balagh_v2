import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { saveProfile, useAccount } from '@/account'
import type { Profile } from '@/api'
import type { IconName } from '@/components/kit'
import { ltr, roleLabel } from '@/components/tabs/role'
import { Button, Field, Notice, Screen } from '@/components/ui'
import { writeToAdmin } from '@/contact'
import { C, F } from '@/theme'

// The server's check, as the sign-up form makes it (AccountGate).
const PHONE = /^\+?[0-9 ()-]{6,40}$/

function profileError(p: Profile): string | null {
  if (p.full_name.length < 2) return 'اكتب اسمك الكامل.'
  if (p.specialization.length < 2) return 'اكتب تخصصك.'
  if (!PHONE.test(p.phone)) return 'رقم الهاتف غير صالح: أرقام فقط، ويمكن أن يبدأ بـ +.'
  return null
}

/** A detail the person cannot change here, and why. */
function Locked({ icon, label, value, why, last }: { icon: IconName; label: string; value: ReactNode; why: string; last?: boolean }) {
  return (
    <View style={[st.locked, !last && st.divider]} accessible accessibilityLabel={`${label}: ${value}. ${why}`}>
      <Ionicons name={icon} size={20} color={C.muted} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={st.lockedLabel}>{label}</Text>
        <Text style={st.lockedValue}>{value}</Text>
      </View>
      <Text style={st.why}>{why}</Text>
    </View>
  )
}

/** Correcting the sign-up details of an approved account. The email comes from the sign-in, the standing
 * from the admin. */
export default function EditProfile() {
  const account = useAccount()
  const me = account.kind === 'approved' ? account.me : null
  const [fullName, setFullName] = useState(me?.full_name ?? me?.name ?? '')
  const [phone, setPhone] = useState(me?.phone ?? '')
  const [specialization, setSpecialization] = useState(me?.specialization ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!me) return null

  const profile: Profile = { full_name: fullName.trim(), specialization: specialization.trim(), phone: phone.trim() }
  const specChanged = profile.specialization !== (me.specialization ?? '').trim()
  const changed = specChanged || profile.full_name !== (me.full_name ?? '').trim() || profile.phone !== (me.phone ?? '').trim()

  const save = async () => {
    const problem = profileError(profile)
    if (problem) return setError(problem)
    setBusy(true)
    setError(null)
    try {
      await saveProfile(profile)
      router.back()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <Screen>
      <View style={st.card}>
        <Field label="الاسم الكامل" value={fullName} onChangeText={setFullName} maxLength={200} autoComplete="name" textContentType="name" />
        <Field
          label="رقم الهاتف"
          value={phone}
          onChangeText={setPhone}
          maxLength={40}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder="+213 5XX XX XX XX"
        />
        <View style={{ gap: 8 }}>
          <Field label="التخصص" value={specialization} onChangeText={setSpecialization} maxLength={120} placeholder="مثال: علوم شرعية، إعلام، تصميم…" />
          {specChanged && (
            <View style={st.specNote} accessibilityLiveRegion="polite">
              <Text style={st.specNoteText}>تغيير التخصص تراجعه الإدارة، وقد تتغير صفتك بعده. حسابك يبقى فعّالا أثناء المراجعة.</Text>
            </View>
          )}
        </View>
        {error && <Notice tone="bad">{error}</Notice>}
        <Button title="احفظ التغييرات" onPress={() => void save()} busy={busy} disabled={!changed} />
      </View>

      <View style={[st.card, { paddingVertical: 6, gap: 0 }]}>
        <Locked icon="mail-outline" label="البريد" value={ltr(me.email) || '—'} why="من حساب الدخول" />
        <Locked icon="shield-checkmark-outline" label="الصفة" value={roleLabel(me.role)} why="تحددها الإدارة" last />
      </View>
      <Text style={st.footer}>
        لتغيير الصفة،{' '}
        <Text style={st.link} onPress={() => void writeToAdmin()} accessibilityRole="link">
          تواصل مع الإدارة
        </Text>
        .
      </Text>
    </Screen>
  )
}

const st = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 16, gap: 14 },
  specNote: { backgroundColor: C.goldSoft, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  specNoteText: { fontFamily: F.regular, fontSize: 12, lineHeight: 20, color: '#5a3d00' },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, minHeight: 56 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#ebe8df' },
  lockedLabel: { fontFamily: F.regular, fontSize: 13, color: C.muted },
  lockedValue: { fontFamily: F.semibold, fontSize: 14, color: C.ink },
  why: { fontFamily: F.regular, fontSize: 12, color: C.muted },
  link: { fontFamily: F.bold, color: C.brand, textDecorationLine: 'underline' },
  footer: { fontFamily: F.regular, fontSize: 12, lineHeight: 20, color: C.muted, textAlign: 'center' },
})
