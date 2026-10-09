import Constants from 'expo-constants'
import * as Updates from 'expo-updates'
import { useState } from 'react'
import { Linking, StyleSheet, Switch, Text, View } from 'react-native'
import { SITE } from '@/api'
import { VIEWER_ROLES } from '@/components/Feedback'
import { Button, Card, Chip, Field, H3, Notice, P, Row, Screen } from '@/components/ui'
import { setPrefs, usePrefs } from '@/prefs'
import type { ViewerRole } from '@/shared/types'
import { C, F } from '@/theme'

/** Settings kept on this device, the app's version and its over-the-air updates, and what Balagh is. */
export default function Settings() {
  const prefs = usePrefs()
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
      <Card>
        <H3>التوليد</H3>
        <View style={st.switchRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={st.label}>مراجعة آلية تلقائية</Text>
            <P small muted>بعد كل سيناريو جديد، يشغّل بلاغ المراجعين الثلاثة مباشرة.</P>
          </View>
          <Switch value={prefs.autoReview} onValueChange={(v) => void setPrefs({ autoReview: v })} trackColor={{ true: C.brand, false: C.lineStrong }} thumbColor={C.surface} />
        </View>
      </Card>

      <Card>
        <H3>هويتك في التقييمات</H3>
        <P small muted>تُملأ تلقائيا في نموذج «أعطنا رأيك» تحت كل فيديو.</P>
        <Field label="الاسم" value={prefs.raterName} onChangeText={(t) => void setPrefs({ raterName: t })} maxLength={80} />
        <Text style={st.label}>الاختصاص</Text>
        <Row>
          {(Object.keys(VIEWER_ROLES) as ViewerRole[]).map((r) => (
            <Chip key={r} label={VIEWER_ROLES[r]} on={prefs.raterRole === r} onPress={() => void setPrefs({ raterRole: r })} />
          ))}
        </Row>
      </Card>

      <Card>
        <H3>التطبيق</H3>
        <View style={st.kv}>
          <Text style={st.k}>النسخة</Text>
          <Text style={st.v}>{Constants.expoConfig?.version ?? '—'}</Text>
        </View>
        <View style={st.kv}>
          <Text style={st.k}>قناة التحديث</Text>
          <Text style={st.v}>{Updates.channel || 'التطوير'}</Text>
        </View>
        <View style={st.kv}>
          <Text style={st.k}>التحديث الحالي</Text>
          <Text style={st.v}>{Updates.updateId ? Updates.updateId.slice(0, 8) : 'المضمَّن في التطبيق'}</Text>
        </View>
        <Button title="ابحث عن تحديث" kind="ghost" onPress={() => void checkUpdate()} busy={checking} />
        {update && <Notice>{update}</Notice>}
      </Card>

      <Card>
        <H3>عن بلاغ</H3>
        <P small>
          أداة مدعومة بالذكاء الاصطناعي. النصوص الشرعية تُؤخذ حرفيا من القرآن الكريم والصحيحين، وكل ما عداها صياغة مولَّدة يراجعها الإنسان قبل
          النشر. لا تصدر الأداة فتاوى.
        </P>
        <Button title="افتح الموقع" kind="ghost" onPress={() => void Linking.openURL(SITE)} />
      </Card>
    </Screen>
  )
}

const st = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontFamily: F.semibold, fontSize: 14, color: C.ink },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  k: { fontFamily: F.regular, fontSize: 14, color: C.muted },
  v: { fontFamily: F.semibold, fontSize: 14, color: C.ink },
})
