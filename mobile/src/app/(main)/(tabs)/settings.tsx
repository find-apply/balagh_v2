import Ionicons from '@expo/vector-icons/Ionicons'
import Constants from 'expo-constants'
import { router } from 'expo-router'
import type { Href } from 'expo-router'
import * as Updates from 'expo-updates'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { signOutNow, useAccount } from '@/account'
import type { Me } from '@/api'
import { SITE } from '@/api'
import { VIEWER_ROLES } from '@/components/Feedback'
import { KeyValue } from '@/components/kit'
import { initial, ltr, roleHint, roleLabel } from '@/components/tabs/role'
import { Button, Chip, Field, Notice, Row, Screen } from '@/components/ui'
import { setPrefs, usePrefs } from '@/prefs'
import type { ViewerRole } from '@/shared/types'
import { C, F } from '@/theme'

function Section({ title, sub, children, style }: { title?: string; sub?: string; children: ReactNode; style?: object }) {
  return (
    <View style={[st.section, style]}>
      {(title || sub) && (
        <View style={{ gap: 2 }}>
          {title && (
            <Text style={st.h2} accessibilityRole="header">
              {title}
            </Text>
          )}
          {sub && <Text style={st.sub}>{sub}</Text>}
        </View>
      )}
      {children}
    </View>
  )
}

/** The signed-in account: who, the standing the admin gave, and the details given at sign-up. */
function Account({ me }: { me: Me }) {
  const [leaving, setLeaving] = useState(false)
  return (
    <Section>
      <View style={st.who}>
        <View style={st.avatar} importantForAccessibility="no-hide-descendants">
          <Text style={st.avatarText}>{initial(me)}</Text>
        </View>
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <Text style={st.name} numberOfLines={1}>
            {me.full_name || me.name || '—'}
          </Text>
          {me.email && (
            <Text style={st.email} numberOfLines={1}>
              {ltr(me.email)}
            </Text>
          )}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="عدّل ملفك الشخصي" onPress={() => router.push('/profile' as Href)} style={({ pressed }) => [st.edit, pressed && { backgroundColor: C.bg }]}>
          <Ionicons name="create-outline" size={16} color={C.ink} />
          <Text style={st.editText}>عدّل</Text>
        </Pressable>
      </View>

      <View style={st.role} accessible accessibilityLabel={`الصفة: ${roleLabel(me.role)}. ${roleHint(me.role)}`}>
        <Ionicons name="shield-checkmark-outline" size={22} color={C.brand} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={st.roleTitle}>{roleLabel(me.role)}</Text>
          <Text style={st.roleHint}>{roleHint(me.role)}</Text>
        </View>
      </View>
      {me.specialization_changed && <Notice tone="warn">تغيير تخصصك بانتظار مراجعة الإدارة. حسابك يبقى فعّالا أثناء المراجعة.</Notice>}

      <KeyValue
        rows={[
          ['التخصص', me.specialization || '—'],
          ['الهاتف', ltr(me.phone) || '—'],
        ]}
      />
      <Button
        title="تسجيل الخروج"
        kind="ghost"
        busy={leaving}
        onPress={() => {
          setLeaving(true)
          signOutNow().catch(() => setLeaving(false))
        }}
      />
    </Section>
  )
}

const APP_LANGUAGES = [
  { code: 'ar', native: 'العربية', hint: 'من اليمين إلى اليسار', ready: true },
  { code: 'en', native: 'English', hint: 'الإنجليزية · من اليسار إلى اليمين', ready: false },
]

/** Settings: the account, the app's language, settings kept on this device, the app's version and its
 * over-the-air updates, what Balagh is, and deleting the account. */
export default function Settings() {
  const prefs = usePrefs()
  const account = useAccount()
  const [update, setUpdate] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  // Over the air: a new JavaScript bundle for this build's version, fetched and applied on the spot.
  const checkUpdate = async () => {
    setChecking(true)
    setUpdate(null)
    try {
      const found = await Updates.checkForUpdateAsync()
      if (!found.isAvailable) {
        setUpdate('التطبيق محدَّث.')
        return
      }
      setUpdate('وُجد تحديث، يُحمَّل…')
      await Updates.fetchUpdateAsync()
      await Updates.reloadAsync()
    } catch (e) {
      setUpdate(Updates.isEnabled ? (e instanceof Error ? e.message : String(e)) : 'التحديث المباشر يعمل في النسخة المبنية من التطبيق، لا في وضع التطوير.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <Screen>
      {account.kind === 'approved' && <Account me={account.me} />}

      <Section title="لغة التطبيق" sub="لغة القوائم والأزرار. لغة المحتوى تختارها مع كل مشروع.">
        <View style={st.radios} accessibilityRole="radiogroup">
          {APP_LANGUAGES.map((l, i) => {
            const on = l.code === 'ar'
            return (
              <View
                key={l.code}
                accessible
                accessibilityRole="radio"
                accessibilityState={{ checked: on, disabled: !l.ready }}
                accessibilityLabel={`${l.native}${l.ready ? '' : '، قريبا'}`}
                style={[st.radio, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }, on && { backgroundColor: C.brandSoft }, !l.ready && { opacity: 0.55 }]}
              >
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={st.radioLabel}>{l.native}</Text>
                  <Text style={st.sub}>{l.hint}</Text>
                </View>
                {!l.ready && (
                  <View style={st.soon}>
                    <Text style={st.soonText}>قريبا</Text>
                  </View>
                )}
                <View style={[st.ring, { borderColor: on ? C.brand : C.lineStrong }]}>{on && <View style={st.dot} />}</View>
              </View>
            )
          })}
        </View>
      </Section>

      <Section title="التوليد">
        <View style={st.switchRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={st.label}>مراجعة آلية تلقائية</Text>
            <Text style={st.sub}>بعد كل سيناريو جديد، يشغّل بلاغ المراجعين الثلاثة مباشرة.</Text>
          </View>
          <Switch
            accessibilityLabel="مراجعة آلية تلقائية"
            value={prefs.autoReview}
            onValueChange={(v) => void setPrefs({ autoReview: v })}
            trackColor={{ true: C.brand, false: C.lineStrong }}
            thumbColor={C.surface}
          />
        </View>
      </Section>

      <Section title="هويتك في التقييمات" sub="تُملأ تلقائيا في «أعطنا رأيك» تحت كل فيديو.">
        <Field label="الاسم" value={prefs.raterName} placeholder="كما يظهر مع تقييمك" onChangeText={(t) => void setPrefs({ raterName: t })} maxLength={80} />
        <Text style={st.fieldLabel}>الاختصاص</Text>
        <Row>
          {(Object.keys(VIEWER_ROLES) as ViewerRole[]).map((r) => (
            <Chip key={r} label={VIEWER_ROLES[r]} on={prefs.raterRole === r} onPress={() => void setPrefs({ raterRole: r })} />
          ))}
        </Row>
      </Section>

      <Section title="التطبيق">
        <KeyValue
          rows={[
            [
              'النسخة',
              <View key="v" style={st.version}>
                <Text style={st.value}>{ltr(Constants.expoConfig?.version ?? '—')}</Text>
                <View style={st.beta}>
                  <Text style={st.betaText}>نسخة تجريبية</Text>
                </View>
              </View>,
            ],
            ['قناة التحديث', Updates.channel || 'التطوير'],
            ['التحديث الحالي', Updates.updateId ? Updates.updateId.slice(0, 8) : 'المضمَّن في التطبيق'],
          ]}
        />
        <Button title="ابحث عن تحديث" kind="ghost" onPress={() => void checkUpdate()} busy={checking} />
        {update && <Notice>{update}</Notice>}
      </Section>

      <Section title="عن بلاغ">
        <Text style={st.body}>
          أداة مدعومة بالذكاء الاصطناعي. النصوص الشرعية تُؤخذ حرفيا من القرآن الكريم والصحيحين، وكل ما عداها صياغة مولَّدة يراجعها الإنسان قبل النشر. لا
          تصدر الأداة فتاوى.
        </Text>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(SITE)} style={st.link}>
          <Text style={st.linkText}>افتح الموقع</Text>
          <Ionicons name="open-outline" size={16} color={C.brand} />
        </Pressable>
      </Section>

      {account.kind === 'approved' && (
        <Section style={st.danger}>
          <Text style={[st.h2, { color: C.bad, fontSize: 15 }]} accessibilityRole="header">
            حذف الحساب
          </Text>
          <Text style={st.body}>يحذف حسابك ومعلوماتك نهائيا. لا يمكن التراجع عنه.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/delete-account' as Href)} style={({ pressed }) => [st.dangerButton, pressed && { backgroundColor: C.badBg }]}>
            <Text style={st.dangerText}>احذف حسابي…</Text>
          </Pressable>
        </Section>
      )}
    </Screen>
  )
}

const st = StyleSheet.create({
  section: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 16, gap: 12 },
  h2: { fontFamily: F.bold, fontSize: 16, color: C.ink },
  sub: { fontFamily: F.regular, fontSize: 13, lineHeight: 21, color: C.muted },
  body: { fontFamily: F.regular, fontSize: 14, lineHeight: 25, color: '#3d4a45' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: F.bold, fontSize: 22, color: C.brand },
  name: { fontFamily: F.bold, fontSize: 16, color: C.ink },
  email: { fontFamily: F.regular, fontSize: 13, color: C.muted },
  edit: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: C.lineStrong, flexDirection: 'row', alignItems: 'center', gap: 6 },
  editText: { fontFamily: F.semibold, fontSize: 13, color: C.ink },
  role: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.brandSoft, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  roleTitle: { fontFamily: F.bold, fontSize: 15, color: '#0c4a3d' },
  roleHint: { fontFamily: F.regular, fontSize: 12, lineHeight: 19, color: '#2f5a4d' },
  radios: { borderWidth: 1, borderColor: C.line, borderRadius: 14, overflow: 'hidden' },
  radio: { minHeight: 56, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  radioLabel: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  ring: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.brand },
  soon: { backgroundColor: '#f1efe8', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  soonText: { fontFamily: F.semibold, fontSize: 11, color: C.muted },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontFamily: F.semibold, fontSize: 14, color: C.ink },
  fieldLabel: { fontFamily: F.semibold, fontSize: 14, color: C.muted },
  version: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value: { fontFamily: F.semibold, fontSize: 14, color: C.ink },
  beta: { backgroundColor: C.goldSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  betaText: { fontFamily: F.bold, fontSize: 11, color: '#6b4800' },
  link: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  linkText: { fontFamily: F.semibold, fontSize: 14, color: C.brand },
  danger: { backgroundColor: '#fffaf9', borderColor: '#f0c9c3', gap: 8 },
  dangerButton: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e3b7b0', backgroundColor: C.surface, justifyContent: 'center' },
  dangerText: { fontFamily: F.bold, fontSize: 14, color: C.bad },
})
