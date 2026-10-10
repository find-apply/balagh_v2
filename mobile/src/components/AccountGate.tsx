import Ionicons from '@expo/vector-icons/Ionicons'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ActivityIndicator, Alert, AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput,
  useWindowDimensions, View,
} from 'react-native'
import type { TextInputProps } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { deleteAccount, refresh, resetPassword, signInMessage, signInWithEmail, signInWithGoogle, signOutNow, signUpWithEmail } from '@/account'
import type { Account } from '@/account'
import { ApiError } from '@/api'
import type { Me, Profile } from '@/api'
import { IconCircle, KeyValue } from '@/components/kit'
import type { IconName } from '@/components/kit'
import { Splash } from '@/components/Splash'
import { Button, Notice } from '@/components/ui'
import { CONTACT_EMAIL, writeToAdmin } from '@/contact'
import { C, F } from '@/theme'

const PHONE = /^\+?[0-9 ()-]{6,40}$/


const GOLD = '#f2d48a'
const GOLD_INK = '#3d2b00'
const BODY = '#3d4a45'
const SEGMENT_BG = '#f0eee7'

/** Keeps a phone number's leading + in front inside Arabic text (Android ignores writingDirection). */
export const ltr = (t: string | null) => (t ? `⁦${t}⁩` : t)

/** Everything before the app opens: signing in, the sign-up details, and the wait for the admin. */
export function AccountGate({ account }: { account: Exclude<Account, { kind: 'approved' }> }) {
  // Coming back to the app is when someone checks whether they were let in.
  useEffect(() => {
    if (account.kind !== 'pending') return
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh()
    })
    return () => sub.remove()
  }, [account.kind])

  switch (account.kind) {
    case 'loading':
      return <Splash />
    case 'signedOut':
      return <SignIn />
    case 'unreachable':
      return <Unreachable message={account.message} />
    case 'profile':
      return <CompleteProfile me={account.me} />
    case 'pending':
      return <Pending me={account.me} />
    case 'rejected':
      return <Rejected me={account.me} />
  }
}

/* ───────────────────────── Layout pieces ───────────────────────── */

/** The brand's eight-pointed star tiled over a header, as on the site. */
function StarPattern({ height, opacity = 0.13 }: { height: number; opacity?: number }) {
  const { width } = useWindowDimensions()
  const tile = 56
  const cols = Math.ceil(width / tile)
  const rows = Math.ceil(height / tile)
  const cells: ReactNode[] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      cells.push(
        <View key={`${r}-${c}`} style={[pat.cell, { top: r * tile + 18, start: c * tile + 18 }]}>
          <View style={pat.square} />
          <View style={[pat.square, { transform: [{ rotate: '45deg' }] }]} />
        </View>,
      )
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      {cells}
    </View>
  )
}

/** A coloured band at the top with a white card overlapping it; the screen scrolls when the keyboard is up. */
function Shell({ band = C.brand, bandHeight, overlap, header, footer, children }: {
  band?: string
  bandHeight: number
  overlap: number
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
}) {
  const insets = useSafeAreaInsets()
  const height = bandHeight + insets.top
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[sh.band, { height, backgroundColor: band, paddingTop: insets.top }]}>
          <StarPattern height={height} opacity={band === C.brand ? 0.13 : 0.12} />
          {header}
        </View>
        <View style={[sh.card, { marginTop: -overlap }]}>{children}</View>
        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function BetaPill({ big }: { big?: boolean }) {
  return (
    <View style={[sh.beta, big && { height: 30, paddingHorizontal: 14, borderRadius: 15 }]}>
      <Text style={[sh.betaText, big && { fontSize: 13 }]}>{big ? 'نسخة تجريبية ' : 'تجريبية '}{'⁦BETA⁩'}</Text>
    </View>
  )
}

function Divider() {
  return (
    <View style={sh.or}>
      <View style={sh.rule} />
      <Text style={sh.orText}>أو</Text>
      <View style={sh.rule} />
    </View>
  )
}

function GoogleButton({ title, busy, disabled, onPress }: { title: string; busy: boolean; disabled: boolean; onPress: () => void }) {
  const off = busy || disabled
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: off, busy }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [sh.google, pressed && !off && { opacity: 0.85 }, disabled && { opacity: 0.6 }]}
    >
      {busy ? <ActivityIndicator color={C.ink} /> : <Ionicons name="logo-google" size={20} color="#4285F4" />}
      <Text style={sh.googleText}>{title}</Text>
    </Pressable>
  )
}

/** A soft note with an icon, such as the one about the admin's review. */
function Note({ icon, tone = 'brand', children }: { icon: IconName; tone?: 'brand' | 'ok'; children: ReactNode }) {
  const bg = tone === 'ok' ? C.okBg : C.brandSoft
  const fg = tone === 'ok' ? C.ok : C.brand
  return (
    <View style={[sh.note, { backgroundColor: bg }]} accessibilityRole={tone === 'ok' ? 'alert' : undefined}>
      <Ionicons name={icon} size={20} color={fg} style={{ marginTop: 2 }} />
      <Text style={[sh.noteText, { color: tone === 'ok' ? '#14503a' : '#0c4a3d' }]}>{children}</Text>
    </View>
  )
}

const GroupLabel = ({ children }: { children: string }) => <Text style={sh.group}>{children}</Text>

/** A labelled input; `ltr` lays out an email or a phone number left to right, aligned with the Arabic labels. */
function Input({ label, hint, aside, ltr: leftToRight, secret, ...props }: TextInputProps & {
  label: string
  hint?: string
  aside?: ReactNode
  ltr?: boolean
  secret?: boolean
}) {
  const [shown, setShown] = useState(false)
  return (
    <View style={{ gap: 6 }}>
      <View style={sh.labelRow}>
        <Text style={sh.label}>{label}</Text>
        {aside}
      </View>
      <View>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor="#8a938f"
          style={[sh.input, leftToRight && { writingDirection: 'ltr' }, secret && { paddingEnd: 52 }]}
          secureTextEntry={secret && !shown}
          {...props}
        />
        {secret && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={shown ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            onPress={() => setShown((v) => !v)}
            style={sh.eye}
          >
            <Ionicons name={shown ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.muted} />
          </Pressable>
        )}
      </View>
      {!!hint && <Text style={sh.hint}>{hint}</Text>}
    </View>
  )
}

/** A quiet text button (sign out, back), still 44 points tall. */
function TextButton({ title, onPress, disabled, color = C.muted }: { title: string; onPress: () => void; disabled?: boolean; color?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [sh.textButton, pressed && !disabled && { opacity: 0.6 }, disabled && { opacity: 0.45 }]}
    >
      <Text style={[sh.textButtonText, { color }]}>{title}</Text>
    </Pressable>
  )
}

/* ───────────────────────── Sign in / sign up / reset ───────────────────────── */

/** The same checks the server makes, so a mistake is caught before an account is created. */
function profileError(p: Profile): string | null {
  if (p.full_name.length < 2) return 'اكتب اسمك الكامل.'
  if (p.specialization.length < 2) return 'اكتب تخصصك.'
  if (!PHONE.test(p.phone)) return 'رقم الهاتف غير صالح: أرقام فقط، ويمكن أن يبدأ بـ +.'
  return null
}

function ProfileFields({ fullName, specialization, phone, set, nameHint }: {
  fullName: string
  specialization: string
  phone: string
  set: { fullName: (t: string) => void; specialization: (t: string) => void; phone: (t: string) => void }
  nameHint?: string
}) {
  return (
    <>
      <Input
        label="الاسم الكامل"
        value={fullName}
        onChangeText={set.fullName}
        maxLength={200}
        autoComplete="name"
        textContentType="name"
        placeholder="الاسم واللقب"
        hint={nameHint}
      />
      <Input
        label="التخصص"
        value={specialization}
        onChangeText={set.specialization}
        maxLength={120}
        placeholder="مثال: علوم شرعية، إعلام، تصميم"
      />
      <Input
        label="رقم الهاتف"
        value={phone}
        onChangeText={set.phone}
        maxLength={40}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        placeholder="+213 5XX XX XX XX"
        ltr
      />
    </>
  )
}

type Mode = 'in' | 'up' | 'reset'

function Segments({ mode, onChange, disabled }: { mode: Mode; onChange: (m: Mode) => void; disabled: boolean }) {
  const items: [Mode, string][] = [['in', 'لدي حساب'], ['up', 'حساب جديد']]
  return (
    <View style={sh.segments} accessibilityRole="tablist" accessibilityLabel="نوع الدخول">
      {items.map(([m, label]) => {
        const on = mode === m
        return (
          <Pressable
            key={m}
            accessibilityRole="tab"
            accessibilityState={{ selected: on, disabled }}
            onPress={on || disabled ? undefined : () => onChange(m)}
            style={[sh.segment, on && sh.segmentOn]}
          >
            <Text style={[sh.segmentText, on && sh.segmentTextOn]}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function SignIn() {
  const [mode, setMode] = useState<Mode>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState<'google' | 'email' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const switchTo = (m: Mode) => {
    setMode(m)
    setError(null)
    setSent(false)
  }

  const run = async (which: 'google' | 'email', action: () => Promise<void>) => {
    setBusy(which)
    setError(null)
    setSent(false)
    try {
      await action()
    } catch (e) {
      setError(signInMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const submit = () => {
    if (!email.trim()) return setError('اكتب بريدك الإلكتروني.')
    if (mode === 'reset') {
      return void run('email', async () => {
        await resetPassword(email)
        setSent(true)
      })
    }
    if (!password) return setError('اكتب كلمة المرور.')
    if (mode === 'in') return void run('email', () => signInWithEmail(email, password))
    const profile = { full_name: fullName.trim(), specialization: specialization.trim(), phone: phone.trim() }
    const wrong = profileError(profile)
    if (wrong) return setError(wrong)
    if (password.length < 6) return setError('كلمة المرور قصيرة: 6 أحرف على الأقل.')
    void run('email', () => signUpWithEmail(email, password, profile))
  }

  const emailField = (
    <Input
      label="البريد الإلكتروني"
      value={email}
      onChangeText={setEmail}
      keyboardType="email-address"
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="email"
      textContentType="emailAddress"
      placeholder="name@example.com"
      maxLength={320}
      ltr
    />
  )
  const google = (
    <GoogleButton
      title={mode === 'up' ? 'التسجيل بحساب Google' : 'المتابعة بحساب Google'}
      busy={busy === 'google'}
      disabled={busy === 'email'}
      onPress={() => void run('google', signInWithGoogle)}
    />
  )
  const problem = error && <Notice tone="bad">{error}</Notice>

  if (mode === 'reset') {
    return (
      <Shell
        bandHeight={220}
        overlap={40}
        header={
          <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 14 }}>
            <Pressable
              accessibilityRole="button"
              onPress={busy ? undefined : () => switchTo('in')}
              style={({ pressed }) => [sh.back, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="chevron-forward" size={18} color="#fff" />
              <Text style={sh.backText}>رجوع إلى الدخول</Text>
            </Pressable>
            <Text style={[sh.bandTitle, { fontSize: 28, lineHeight: 36, marginHorizontal: 8 }]}>استعادة كلمة المرور</Text>
          </View>
        }
      >
        <Text style={sh.body}>اكتب بريد حسابك، ونرسل إليه رابطا لتعيين كلمة مرور جديدة.</Text>
        {emailField}
        <Button title="أرسل الرابط" onPress={submit} busy={busy === 'email'} />
        {problem}
        {sent && (
          <Note icon="mail-outline" tone="ok">
            أرسلنا الرابط إلى بريدك. إن لم تجده، انظر في مجلد الرسائل غير المرغوبة.
          </Note>
        )}
      </Shell>
    )
  }

  if (mode === 'up') {
    return (
      <Shell
        bandHeight={220}
        overlap={64}
        header={
          <View style={{ paddingHorizontal: 28, paddingTop: 40, gap: 6 }}>
            <Text style={[sh.bandTitle, { fontSize: 30, lineHeight: 40 }]}>انضم إلى بلاغ</Text>
            <Text style={sh.bandTagline}>أخبرنا عنك، وتراجع الإدارة طلبك.</Text>
          </View>
        }
        footer={<Text style={[sh.footer, { marginTop: 20 }]}>بحساب Google نطلب منك التخصص ورقم الهاتف بعد الدخول.</Text>}
      >
        <Segments mode={mode} onChange={switchTo} disabled={busy !== null} />
        <GroupLabel>عنك</GroupLabel>
        <ProfileFields
          fullName={fullName}
          specialization={specialization}
          phone={phone}
          set={{ fullName: setFullName, specialization: setSpecialization, phone: setPhone }}
        />
        <GroupLabel>الدخول</GroupLabel>
        {emailField}
        <Input
          label="كلمة المرور"
          value={password}
          onChangeText={setPassword}
          secret
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="6 أحرف على الأقل"
          maxLength={200}
        />
        <Note icon="shield-checkmark-outline">بعد الإرسال تراجع الإدارة طلبك، ويُفعَّل حسابك بعد الموافقة.</Note>
        {problem}
        <Button title="إنشاء الحساب وإرسال الطلب" onPress={submit} busy={busy === 'email'} disabled={busy === 'google'} />
        <Divider />
        {google}
      </Shell>
    )
  }

  return (
    <Shell
      bandHeight={300}
      overlap={88}
      header={
        <View style={{ paddingHorizontal: 28, paddingTop: 52, gap: 10 }}>
          <View style={sh.brandRow}>
            <View style={sh.logo}>
              <Ionicons name="book-outline" size={24} color="#fff" />
            </View>
            <Text style={[sh.bandTitle, { fontSize: 40, lineHeight: 52 }]} accessibilityRole="header">بلاغ</Text>
            <BetaPill />
          </View>
          <Text style={[sh.bandTagline, { fontSize: 16, lineHeight: 27, maxWidth: 300, marginTop: 6 }]}>
            صناعة محتوى دعوي موثَّق، بمراجعة بشرية قبل النشر.
          </Text>
        </View>
      }
      footer={<Text style={[sh.footer, { marginTop: 'auto', paddingTop: 24 }]}>كل حساب جديد تراجعه الإدارة قبل تفعيله.</Text>}
    >
      <Segments mode={mode} onChange={switchTo} disabled={busy !== null} />
      {emailField}
      <Input
        label="كلمة المرور"
        value={password}
        onChangeText={setPassword}
        secret
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        maxLength={200}
        aside={
          <Pressable
            accessibilityRole="button"
            onPress={busy ? undefined : () => switchTo('reset')}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            style={{ minHeight: 24, justifyContent: 'center' }}
          >
            <Text style={sh.link}>نسيت كلمة المرور؟</Text>
          </Pressable>
        }
      />
      {problem}
      <Button title="دخول" onPress={submit} busy={busy === 'email'} disabled={busy === 'google'} />
      <Divider />
      {google}
    </Shell>
  )
}

/* ───────────────────────── After signing in ───────────────────────── */

/** The first sign-in with Google: the name comes from Google, the rest is asked here. */
function CompleteProfile({ me }: { me: Me }) {
  const google = me.provider === 'google.com'
  const fromGoogle = google && !me.full_name && !!me.name
  const [fullName, setFullName] = useState(me.full_name ?? me.name ?? '')
  const [specialization, setSpecialization] = useState(me.specialization ?? '')
  const [phone, setPhone] = useState(me.phone ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const profile = { full_name: fullName.trim(), specialization: specialization.trim(), phone: phone.trim() }
    const wrong = profileError(profile)
    if (wrong) return setError(wrong)
    setBusy(true)
    setError(null)
    try {
      await refresh(profile)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const initial = (me.full_name || me.name || me.email || '؟').trim().charAt(0).toUpperCase()

  return (
    <Shell
      bandHeight={200}
      overlap={48}
      header={
        <View style={{ paddingHorizontal: 28, paddingTop: 36, gap: 6 }}>
          <Text style={[sh.bandTitle, { fontSize: 28, lineHeight: 36 }]}>أكمل معلوماتك</Text>
          <Text style={sh.bandTagline}>خطوة أخيرة قبل إرسال طلبك.</Text>
        </View>
      }
    >
      <View style={sh.accountChip}>
        <View style={sh.avatar}>
          <Text style={sh.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={sh.chipLabel}>{google ? 'دخلت بحساب Google' : 'دخلت بالبريد'}</Text>
          {!!me.email && (
            <Text style={sh.chipEmail} numberOfLines={1}>
              {ltr(me.email)}
            </Text>
          )}
        </View>
        {google ? <Ionicons name="logo-google" size={20} color="#4285F4" /> : <Ionicons name="mail-outline" size={20} color={C.muted} />}
      </View>
      <ProfileFields
        fullName={fullName}
        specialization={specialization}
        phone={phone}
        set={{ fullName: setFullName, specialization: setSpecialization, phone: setPhone }}
        nameHint={fromGoogle ? 'أخذناه من Google، ويمكنك تعديله.' : undefined}
      />
      <Note icon="shield-checkmark-outline">تراجع الإدارة طلبك، ويُفعَّل حسابك بعد الموافقة.</Note>
      {error && <Notice tone="bad">{error}</Notice>}
      <Button title="إرسال الطلب" onPress={() => void submit()} busy={busy} />
      <TextButton title="الدخول بحساب آخر" onPress={() => void signOutNow()} disabled={busy} />
    </Shell>
  )
}

type StepState = 'done' | 'current' | 'todo'

function TimelineStep({ label, sub, state, last }: { label: string; sub?: string; state: StepState; last?: boolean }) {
  return (
    <View
      style={sh.tlRow}
      accessible
      accessibilityLabel={`${label}${sub ? `، ${sub}` : ''}${state === 'done' ? '، مكتمل' : state === 'current' ? '، الخطوة الحالية' : ''}`}
    >
      <View style={{ alignItems: 'center' }}>
        {state === 'done' ? (
          <View style={[sh.tlDot, { backgroundColor: C.brand, borderWidth: 0 }]}>
            <Ionicons name="checkmark" size={14} color="#fff" />
          </View>
        ) : state === 'current' ? (
          <View style={[sh.tlDot, { borderColor: C.gold, backgroundColor: C.goldSoft }]}>
            <View style={sh.tlCore} />
          </View>
        ) : (
          <View style={[sh.tlDot, { borderColor: C.lineStrong }]} />
        )}
        {!last && <View style={[sh.tlLine, { height: sub ? 34 : 18, backgroundColor: state === 'done' ? C.brand : C.line }]} />}
      </View>
      <View style={{ flex: 1, gap: 1, paddingTop: 2 }}>
        <Text style={[sh.tlLabel, state === 'current' && { fontFamily: F.bold }, state === 'todo' && { color: C.muted }]}>{label}</Text>
        {!!sub && <Text style={sh.tlSub}>{sub}</Text>}
      </View>
    </View>
  )
}

/** A centred icon, title and text at the top of a status card. */
function StatusHead({ icon, tone, title, text, size = 64 }: { icon: IconName; tone: 'warn' | 'bad' | 'info'; title: string; text: string; size?: number }) {
  return (
    <View style={sh.statusHead}>
      <IconCircle icon={icon} tone={tone} size={size} />
      <Text style={sh.statusTitle} accessibilityRole="header">{title}</Text>
      <Text style={[sh.body, { textAlign: 'center', fontSize: 14, maxWidth: 300 }]}>{text}</Text>
    </View>
  )
}

function Pending({ me }: { me: Me }) {
  const [checking, setChecking] = useState(false)
  const [still, setStill] = useState(false)
  const check = async () => {
    setChecking(true)
    await refresh()
    setChecking(false)
    setStill(true)
  }
  return (
    <Shell
      bandHeight={170}
      overlap={100}
      header={
        <View style={{ position: 'absolute', top: 24, end: 20 }}>
          <BetaPill />
        </View>
      }
    >
      <StatusHead
        icon="hourglass-outline"
        tone="warn"
        title="حسابك قيد المراجعة"
        text="تتحقق الإدارة من معلوماتك، وتحدد صفتك، ثم تفعّل حسابك."
      />
      <View accessibilityLabel="مراحل الطلب">
        <TimelineStep label="أُرسل الطلب" state="done" />
        <TimelineStep label="التحقق وتحديد الصفة" sub="مختص شرعي أو صانع محتوى، تحددها الإدارة" state="current" />
        <TimelineStep label="تفعيل الحساب" state="todo" last />
      </View>
      <KeyValue
        rows={[
          ['الاسم', me.full_name ?? '—'],
          ['التخصص', me.specialization ?? '—'],
          ['الهاتف', ltr(me.phone) ?? '—'],
          ['الصفة', <Text key="role" style={sh.roleValue}>تحددها الإدارة</Text>],
        ]}
      />
      {still && !checking && <Notice tone="warn">لم يُفعَّل بعد. أعد المحاولة لاحقا.</Notice>}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: checking, busy: checking }}
        onPress={checking ? undefined : () => void check()}
        style={({ pressed }) => [sh.outline, pressed && !checking && { opacity: 0.8 }]}
      >
        {checking && <ActivityIndicator color={C.brand} />}
        <Text style={sh.outlineText}>تحقق من حالة الطلب</Text>
      </Pressable>
      <TextButton title="تسجيل الخروج" onPress={() => void signOutNow()} disabled={checking} />
      <TextButton title="احذف طلبي وحسابي" onPress={confirmDelete} disabled={checking} />
    </Shell>
  )
}

/** A request waiting for review can be withdrawn: the account and the details it gave are deleted. */
function confirmDelete() {
  Alert.alert('حذف الحساب', 'يُحذف حسابك ومعلومات التسجيل نهائيا، ويُلغى طلبك.', [
    { text: 'إلغاء', style: 'cancel' },
    {
      text: 'احذف',
      style: 'destructive',
      onPress: () => void deleteAccount().catch((e: unknown) => Alert.alert('تعذر الحذف', e instanceof Error ? e.message : String(e))),
    },
  ])
}

function Rejected({ me }: { me: Me }) {
  return (
    <Shell band="#4a5550" bandHeight={200} overlap={120}>
      <StatusHead
        icon="close-circle-outline"
        tone="bad"
        size={72}
        title="لم يُقبل طلبك"
        text="راجعت الإدارة طلبك ولم تقبل هذا الحساب. إن رأيت أن في ذلك خطأ، تواصل معنا وسنعيد النظر فيه."
      />
      {!!me.email && <KeyValue rows={[['الحساب', ltr(me.email) ?? '']]} />}
      <View style={{ gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityHint={CONTACT_EMAIL}
          onPress={() => void writeToAdmin()}
          style={({ pressed }) => [sh.primary, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="mail-outline" size={18} color="#fff" />
          <Text style={sh.primaryText}>تواصل معنا</Text>
        </Pressable>
        <Button title="الدخول بحساب آخر" kind="ghost" onPress={() => void signOutNow()} />
      </View>
    </Shell>
  )
}

function Unreachable({ message }: { message: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <Shell band="#4a5550" bandHeight={200} overlap={120}>
      <StatusHead icon="cloud-offline-outline" tone="info" title="تعذر التحقق من حسابك" text="لم نصل إلى الخادم. تأكد من اتصالك بالإنترنت، ثم أعد المحاولة." />
      <Notice tone="bad">{message}</Notice>
      <Button
        title="أعد المحاولة"
        busy={busy}
        onPress={() => {
          setBusy(true)
          void refresh().finally(() => setBusy(false))
        }}
      />
      <TextButton title="تسجيل الخروج" onPress={() => void signOutNow()} disabled={busy} />
    </Shell>
  )
}

/* ───────────────────────── Styles ───────────────────────── */

const pat = StyleSheet.create({
  cell: { position: 'absolute', width: 20, height: 20 },
  square: { position: 'absolute', width: 20, height: 20, borderWidth: 1.2, borderColor: '#fff' },
})

const sh = StyleSheet.create({
  band: { overflow: 'hidden' },
  card: {
    marginHorizontal: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 24,
    paddingVertical: 24, paddingHorizontal: 20, gap: 16,
    shadowColor: C.ink, shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 16 }, elevation: 4,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center',
  },
  bandTitle: { fontFamily: F.bold, color: '#fff' },
  bandTagline: { fontFamily: F.regular, fontSize: 15, lineHeight: 25, color: 'rgba(255,255,255,0.86)' },
  beta: { height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: GOLD, justifyContent: 'center' },
  betaText: { fontFamily: F.bold, fontSize: 11, color: GOLD_INK },
  back: {
    alignSelf: 'flex-start', minHeight: 44, paddingStart: 10, paddingEnd: 14, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.14)', flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  backText: { fontFamily: F.medium, fontSize: 14, color: '#fff' },
  segments: { flexDirection: 'row', gap: 4, backgroundColor: SEGMENT_BG, borderRadius: 14, padding: 4 },
  segment: { flex: 1, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segmentOn: {
    backgroundColor: C.surface, shadowColor: C.ink, shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  segmentText: { fontFamily: F.medium, fontSize: 15, color: C.muted },
  segmentTextOn: { fontFamily: F.semibold, color: C.ink },
  group: { fontFamily: F.semibold, fontSize: 12, color: C.muted, marginTop: 4, marginBottom: -6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontFamily: F.semibold, fontSize: 14, color: C.ink },
  link: { fontFamily: F.medium, fontSize: 13, color: C.brand },
  hint: { fontFamily: F.regular, fontSize: 12, color: C.muted },
  input: {
    minHeight: 52, fontFamily: F.regular, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 16, backgroundColor: C.surface, color: C.ink,
  },
  eye: { position: 'absolute', end: 4, top: 4, width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  or: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rule: { flex: 1, height: 1, backgroundColor: C.line },
  orText: { fontFamily: F.regular, fontSize: 13, color: C.muted },
  google: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 52, borderRadius: 12,
    borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.surface,
  },
  googleText: { fontFamily: F.semibold, fontSize: 15, color: C.ink },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  noteText: { flex: 1, fontFamily: F.regular, fontSize: 13, lineHeight: 22 },
  footer: { fontFamily: F.regular, fontSize: 13, lineHeight: 22, color: C.muted, textAlign: 'center', marginHorizontal: 32 },
  body: { fontFamily: F.regular, fontSize: 15, lineHeight: 27, color: BODY },
  accountChip: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.bg, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: F.bold, fontSize: 17, color: C.brand },
  chipLabel: { fontFamily: F.regular, fontSize: 13, color: C.muted },
  chipEmail: { fontFamily: F.semibold, fontSize: 14, color: C.ink },
  statusHead: { alignItems: 'center', gap: 10 },
  statusTitle: { fontFamily: F.bold, fontSize: 22, lineHeight: 32, color: C.ink, textAlign: 'center' },
  tlRow: { flexDirection: 'row', gap: 12 },
  tlDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tlCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.gold },
  tlLine: { width: 2 },
  tlLabel: { fontFamily: F.semibold, fontSize: 14, color: C.ink },
  tlSub: { fontFamily: F.regular, fontSize: 12, color: C.muted },
  roleValue: { fontFamily: F.semibold, fontSize: 14, color: C.warn },
  outline: {
    flexDirection: 'row', gap: 8, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: C.brand, backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  outlineText: { fontFamily: F.semibold, fontSize: 15, color: C.brand },
  textButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: -6 },
  textButtonText: { fontFamily: F.semibold, fontSize: 14 },
  primary: {
    flexDirection: 'row', gap: 8, minHeight: 52, borderRadius: 12, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center',
  },
  primaryText: { fontFamily: F.bold, fontSize: 15, color: '#fff' },
})
