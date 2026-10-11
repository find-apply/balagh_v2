import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Animated, I18nManager, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { api, BASE } from '@/api'
import { IconCircle, SubSteps } from '@/components/kit'
import { Badge, Button, H2, Notice, P } from '@/components/ui'
import { VideoPlayer } from '@/components/VideoPlayer'
import { aspectOf, isChildren, templateOptions, VIDEO_STATUS, videoErrorText } from '@/shared/labels'
import type { TemplateOption } from '@/shared/labels'
import type { Script, Video, VideoStatus, VideoTemplate } from '@/shared/types'
import { C, F } from '@/theme'
import { ACTIVE, Collapsible, IconButton, LinkButton, message, scenesLabel, shortDate } from './common'
import { TemplatePreview } from './TemplatePreview'
import type { PreviewLine } from './TemplatePreview'

const STEPS = ['القالب', 'المشاهد', 'الفيديو']

/** Where the video part opens: the video when there is one, the scenes once a template is chosen, else the templates. */
function firstStep(script: Script, videos: Video[], focus?: string): number {
  if (focus || videos.length > 0) return 2
  return script.template ? 1 : 0
}

/** Lines a template card plays: the hook, the first scenes' on-screen text, then the first verified text. */
function cardLines(script: Script): PreviewLine[] {
  const lines: PreviewLine[] = []
  if (script.hook) lines.push({ text: script.hook })
  script.scenes.slice(0, 3).forEach((s) => s.on_screen_text && lines.push({ text: s.on_screen_text }))
  const ref = script.references[0]
  if (ref) lines.push({ text: `«${ref.arabic || ref.text}»`, quote: true })
  return lines.length ? lines : [{ text: script.title }]
}

/** geo puts the verified text first: it is what that template stands on. */
function geoLines(script: Script): PreviewLine[] {
  const refs = script.references.map((r) => ({ text: `«${r.arabic || r.text}»`, quote: true }))
  return refs.length ? refs : cardLines(script)
}

export function VideoPart({ projectId, script, templates, videos, focus, onChanged, onVideos, onNext }: {
  projectId: string
  script: Script
  templates: VideoTemplate[] | null
  videos: Video[] | null
  focus?: string
  onChanged: () => Promise<void>
  onVideos: () => Promise<void>
  onNext: () => void
}) {
  const [step, setStep] = useState<number | null>(null)
  const [shownId, setShownId] = useState<string | null>(focus ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (templates === null || videos === null) return <P muted>يحمّل…</P>

  const aspect = aspectOf(script.platforms)
  const tall = aspect === '9:16'
  // As on the site: one card per template in the platform's frame, the ones this audience cannot use greyed with why.
  const options = templateOptions(templates, aspect, script.target.audience)
  const nameOf = (id: string | null) => templates.find((t) => t.id === id)?.name ?? id ?? ''

  const newest = videos[0]
  const running = videos.some((v) => ACTIVE.has(v.status))
  // A new render takes the screen over: it is what the user just asked for.
  const latest = newest && ACTIVE.has(newest.status) ? newest : (videos.find((v) => v.id === shownId) ?? newest)
  const failed = latest?.status === 'failed'

  let current = step ?? firstStep(script, videos, focus)
  if (current === 1 && !script.template) current = 0
  if (current === 2 && !latest) current = script.template ? 1 : 0

  const act = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  const create = (template: string) =>
    act(async () => {
      const v = await api.createVideo(projectId, script.id, template)
      setShownId(v.id)
      await onVideos()
      setStep(2)
    })
  const go = (i: number) => {
    if (i === 1 && !script.template) return
    if (i === 2 && !latest) return
    setError(null)
    setStep(i)
  }

  return (
    <>
      <SubSteps labels={STEPS} current={current} onPress={go} error={current === 2 && failed} />
      {current === 0 && (
        <TemplateStep
          projectId={projectId}
          script={script}
          options={options}
          busy={busy}
          error={error}
          onChoose={(id) =>
            void act(async () => {
              if (script.template !== id) {
                await api.chooseTemplate(projectId, script.id, id)
                await onChanged()
              }
              setStep(1)
            })
          }
        />
      )}
      {current === 1 && script.template && (
        <ScenesStep
          script={script}
          template={script.template}
          templateName={nameOf(script.template)}
          wide={(templates.find((t) => t.id === script.template)?.aspect ?? (tall ? '9:16' : '16:9')) === '16:9'}
          running={running}
          busy={busy}
          error={error}
          onChange={() => go(0)}
          onCreate={() => void create(script.template!)}
          onFollow={() => go(2)}
        />
      )}
      {current === 2 && latest && (
        <VideoStep
          script={script}
          video={latest}
          others={videos.filter((v) => v.id !== latest.id && v.status === 'done')}
          templates={templates}
          tall={tall}
          busy={busy}
          error={error}
          onShow={setShownId}
          onRetry={() => void create(latest.template)}
          onFinal={() => void create(script.template ?? latest.template)}
          onOther={() => go(0)}
          onNext={onNext}
        />
      )}
    </>
  )
}

const GAP = 12

/** The templates side by side at full size, swiped through one at a time (or reached by name above), each playing;
 * under the one in the middle its facts and the one action it allows: choose it, go on with it, or, for one this
 * audience cannot use, why and the way to it. */
function TemplateStep({ projectId, script, options, busy, error, onChoose }: {
  projectId: string
  script: Script
  options: TemplateOption[]
  busy: boolean
  error: string | null
  onChoose: (id: string) => void
}) {
  const kids = isChildren(script.target.audience)
  const isChosen = (o: TemplateOption) => o.group !== 'blocked' && script.template != null && o.family.includes(script.template)
  const [idx, setIdx] = useState(() => Math.max(0, options.findIndex(isChosen)))
  const [width, setWidth] = useState(0)
  const cardW = Math.min(230, Math.round(width * 0.56))
  const step = cardW + GAP
  // The strip is drawn by hand, not by a scroll view (whose right-to-left offsets Android gets wrong): cards side by
  // side from the start edge, all moved together so the one in view sits in the middle. In right-to-left the next
  // card lies to the left, so bringing it in moves the strip right.
  const dir = I18nManager.isRTL ? 1 : -1
  const [shift] = useState(() => new Animated.Value(0))
  const go = (i: number) => {
    setIdx(i)
    Animated.spring(shift, { toValue: dir * i * step, useNativeDriver: true, bounciness: 4 }).start()
  }
  useEffect(() => {
    // the card in view in the middle as the step opens, and again if the width changes; moves between cards spring
    shift.setValue(dir * idx * step)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])
  // A drag of a quarter card, or a flick, moves one card the way the finger pulled the strip: in right-to-left,
  // pulling it right brings in the next card from the left. The pan is gesture-handler's, as the side drawer's is,
  // so a sideways drag on the strip moves the strip and not the drawer; a vertical one still scrolls the page.
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onUpdate((e) => shift.setValue(dir * idx * step + e.translationX))
    .onEnd((e) => {
      const moved = Math.abs(e.translationX) > step / 4 || Math.abs(e.velocityX) > 500 ? Math.sign(e.translationX) * dir : 0
      go(Math.min(options.length - 1, Math.max(0, idx + moved)))
    })
  const o = options[idx]
  if (!o) return <Notice tone="warn">لا قالب في المكتبة الآن.</Notice>
  const t = o.template
  const blocked = o.group === 'blocked'
  return (
    <>
      <View style={{ gap: 2 }}>
        <H2>اختر القالب</H2>
        <P muted small>اسحب لتشاهد كل قالب يتحرك، بلا صوت.</P>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.bleed} contentContainerStyle={st.chips}>
        {options.map((x, i) => {
          const on = i === idx
          const off = x.group === 'blocked'
          return (
            <Pressable
              key={x.template.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${x.template.name}${off ? '، غير متاح' : ''}`}
              onPress={() => go(i)}
              style={[st.chip, off && st.chipOff, on && st.chipOn]}
            >
              {off && <Ionicons name="lock-closed" size={12} color={on ? '#fff' : C.muted} />}
              {isChosen(x) && <Ionicons name="checkmark" size={14} color={on ? '#fff' : C.brand} />}
              <Text style={[st.chipText, off && { color: C.muted }, on && { color: '#fff' }]}>{x.template.name}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
      <View
        style={st.bleed}
        onLayout={(e) => {
          const w = Math.round(e.nativeEvent.layout.width)
          if (w !== width) setWidth(w)
        }}
      >
        {width > 0 && (
          <GestureDetector gesture={swipe}>
            <View style={{ height: Math.round((cardW * 16) / 9), overflow: 'hidden' }}>
              <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: shift }] }]}>
                {options.map((x, i) => {
                  const on = i === idx
                  const off = x.group === 'blocked'
                  const wide = x.template.aspect === '16:9'
                  const h = wide ? (cardW * 9) / 16 : (cardW * 16) / 9
                  return (
                    <Pressable
                      key={x.template.id}
                      accessibilityLabel={x.template.name}
                      accessibilityState={{ selected: on }}
                      onPress={() => !on && go(i)}
                      style={{
                        position: 'absolute',
                        start: (width - cardW) / 2 + i * step,
                        top: (Math.round((cardW * 16) / 9) - h) / 2,
                        width: cardW,
                        opacity: on ? 1 : 0.55,
                        transform: [{ scale: on ? 1 : 0.9 }],
                      }}
                    >
                      <TemplatePreview template={x.template.id} lines={x.template.id === 'geo' ? geoLines(script) : cardLines(script)} wide={wide} style={{ borderRadius: 20 }} />
                      {off && (
                        <View style={st.lockChip}>
                          <Ionicons name="lock-closed" size={11} color="#fff" />
                          <Text style={st.lockText}>غير متاح</Text>
                        </View>
                      )}
                    </Pressable>
                  )
                })}
              </Animated.View>
            </View>
          </GestureDetector>
        )}
      </View>
      <View style={st.dots} importantForAccessibility="no-hide-descendants">
        {options.map((x, i) => (
          <View key={x.template.id} style={[st.dot, i === idx && st.dotOn]} />
        ))}
      </View>
      <View style={{ gap: 4 }} accessibilityLiveRegion="polite">
        <Text style={st.nowName}>{t.name}</Text>
        <Text style={st.nowFacts}>
          {t.aspect === '16:9' ? 'عريض 16:9' : 'عمودي 9:16'} · {t.uses_images ? 'رسوم وصور' : 'رسوم فقط'}
          {t.typical_seconds != null ? ` · التصيير ${Math.ceil(t.typical_seconds / 60)} د تقريبا` : ''}
        </Text>
        <Text style={st.nowDesc}>{t.description}</Text>
        {o.group === 'other' && <Text style={st.nowOther}>{o.reason}</Text>}
      </View>
      {error && <Notice tone="bad">{error}</Notice>}
      {blocked ? (
        <View style={{ gap: 10 }}>
          <Text style={st.why}>
            <Ionicons name="lock-closed" size={13} color={C.warn} /> {o.reason}
          </Text>
          {o.needsKids && !kids && (
            <Button
              kind="ghost"
              title="وطّن السيناريو للأطفال"
              onPress={() => router.push({ pathname: '/localize', params: { id: projectId, sid: script.id, kids: '1' } })}
            />
          )}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {t.story && !isChosen(o) && (
            <Notice>أول اختيار لقالب أطفال يكتب بلاغ منه قصة حوار بالشخصيات الثابتة (نحو دقيقة)، وهي نص جديد يلزم اعتماده.</Notice>
          )}
          {isChosen(o) && (
            <Text style={st.chosen}>
              <Ionicons name="checkmark" size={16} color={C.brand} /> قالب مشروعك
            </Text>
          )}
          <Button title={isChosen(o) ? 'التالي: شاهد المشاهد' : `اختر «${t.name}»`} busy={busy} onPress={() => onChoose(t.id)} />
        </View>
      )}
    </>
  )
}

function ScenesStep({ script, template, templateName, wide, running, busy, error, onChange, onCreate, onFollow }: {
  script: Script
  template: string
  templateName: string
  wide: boolean
  running: boolean
  busy: boolean
  error: string | null
  onChange: () => void
  onCreate: () => void
  onFollow: () => void
}) {
  const refs = new Map(script.references.map((r) => [r.evidence_id, r]))
  return (
    <>
      <View style={st.headRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <H2>المشاهد</H2>
          <P muted small>
            {scenesLabel(script.scenes.length)} · {script.duration_seconds} ث · {templateName}
          </P>
        </View>
        <LinkButton title="غيّر القالب" onPress={onChange} />
      </View>
      {script.scenes.map((sc, i) => {
        const ref = sc.evidence_ids.map((e) => refs.get(e)).find(Boolean)
        const line: PreviewLine = sc.on_screen_text
          ? { text: sc.on_screen_text, quote: sc.on_screen_text.trim().startsWith('«') }
          : ref
            ? { text: `«${ref.arabic || ref.text}»`, quote: true }
            : { text: sc.voiceover }
        return (
          <View key={i} style={st.scene}>
            <View style={wide ? { width: 150 } : { width: 104 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <TemplatePreview template={template} lines={[line]} size="scene" delay={(i % 4) * 1000} wide={wide} />
            </View>
            <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
              <View style={st.badges}>
                <Badge tone="brand">المشهد {i + 1}</Badge>
                <Badge>
                  {sc.start_second}–{sc.end_second} ث
                </Badge>
              </View>
              <P small ltr={script.target.language === 'en'}>{sc.voiceover}</P>
              {ref ? (
                <Text style={st.refSource}>✓ {ref.source}</Text>
              ) : (
                !!sc.on_screen_text && <Text style={st.onScreen}>على الشاشة: {sc.on_screen_text}</Text>
              )}
            </View>
          </View>
        )
      })}
      <P muted small>المعاينات تقريبية تُرسم على هاتفك. الفيديو الحقيقي بالصوت يُصنع عند الإنشاء ويأخذ بضع دقائق.</P>
      {error && <Notice tone="bad">{error}</Notice>}
      {running ? (
        <Button title="يُصنع فيديو الآن: تابعه" onPress={onFollow} />
      ) : (
        <IconButton
          icon="film-outline"
          title={script.approved ? 'أنشئ الفيديو النهائي' : 'أنشئ فيديو المعاينة (بعلامة مائية)'}
          busy={busy}
          onPress={onCreate}
        />
      )}
    </>
  )
}

/** The stages a render goes through, with an estimate from the template's usual time. */
function Rendering({ video, template }: { video: Video; template?: VideoTemplate }) {
  const started = Date.parse(video.created_at)
  const since = () => (Number.isNaN(started) ? 0 : Math.max(0, Math.floor((Date.now() - started) / 1000)))
  const [seconds, setSeconds] = useState(since)
  useEffect(() => {
    const t = setInterval(() => setSeconds(since()), 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id])
  const expected = template?.typical_seconds ?? 180
  const percent = Math.round(92 * (1 - Math.exp(-seconds / (expected * 0.6))))
  const stages: VideoStatus[] = ['queued', 'voicing', ...(template?.uses_images ? (['imaging'] as VideoStatus[]) : []), 'rendering']
  const at = Math.max(0, stages.indexOf(video.status))
  return (
    <View style={{ gap: 10 }} accessibilityLiveRegion="polite">
      <View style={st.renderHead}>
        <ActivityIndicator color={C.brand} />
        <Text style={st.renderTitle}>{VIDEO_STATUS[video.status]}</Text>
        <Text style={st.renderTime}>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} من نحو {Math.max(1, Math.round(expected / 60))} د
        </Text>
      </View>
      <View style={st.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }}>
        <View style={[st.barFill, { width: `${percent}%` }]} />
      </View>
      {stages.map((s, i) => (
        <Text key={s} style={[st.stage, i < at && { color: C.ok }, i === at && { color: C.ink, fontFamily: F.bold }]}>
          {i < at ? '✓ ' : i === at ? '◉ ' : '○ '}
          {VIDEO_STATUS[s]}
        </Text>
      ))}
      <P muted small>يُصنع الفيديو، يأخذ عادة بضع دقائق. يمكنك الخروج والعودة.</P>
    </View>
  )
}

function VideoStep({ script, video, others, templates, tall, busy, error, onShow, onRetry, onFinal, onOther, onNext }: {
  script: Script
  video: Video
  others: Video[]
  templates: VideoTemplate[]
  tall: boolean
  busy: boolean
  error: string | null
  onShow: (id: string) => void
  onRetry: () => void
  onFinal: () => void
  onOther: () => void
  onNext: () => void
}) {
  const template = templates.find((t) => t.id === video.template)
  const name = template?.name ?? video.template

  if (video.status === 'failed')
    return (
      <>
        <View style={[st.section, st.failed]} accessibilityRole="alert">
          <IconCircle icon="alert-circle-outline" tone="bad" size={56} />
          <H2>تعذّر إنشاء الفيديو</H2>
          <View style={st.badges}>
            <Badge tone="bad">{VIDEO_STATUS.failed}</Badge>
            <Badge>{name}</Badge>
          </View>
          <P>{videoErrorText(video.error)}</P>
          <P muted small>السيناريو ومراجعته لم يتأثرا. أعد المحاولة، أو جرّب قالبا آخر.</P>
        </View>
        {error && <Notice tone="bad">{error}</Notice>}
        <IconButton icon="refresh" title="أعد المحاولة" busy={busy} onPress={onRetry} />
        <Button title="جرّب قالبا آخر" kind="ghost" onPress={onOther} />
      </>
    )

  const url = video.url ? BASE + video.url : null
  return (
    <>
      <View style={st.section}>
        <View style={st.badges}>
          <Badge tone={video.status === 'done' ? 'ok' : 'info'}>{VIDEO_STATUS[video.status]}</Badge>
          <Badge tone={video.preview ? 'warn' : 'ok'}>{video.preview ? 'معاينة بعلامة مائية' : 'الفيديو النهائي'}</Badge>
          <Badge>{name}</Badge>
          {video.duration_seconds != null && <Badge>{Math.round(video.duration_seconds)} ث</Badge>}
        </View>
        {ACTIVE.has(video.status) && <Rendering video={video} template={template} />}
        {video.status === 'done' && url && (
          <>
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: (template?.aspect ?? (tall ? '9:16' : '16:9')) === '16:9' ? '100%' : 270, maxWidth: '100%' }}>
                <VideoPlayer
                  key={video.id}
                  uri={url}
                  poster={video.frames[0] ? BASE + video.frames[0] : null}
                  tall={(template?.aspect ?? (tall ? '9:16' : '16:9')) !== '16:9'}
                  seconds={video.duration_seconds}
                />
              </View>
            </View>
            <View style={st.pair}>
              <IconButton
                icon="star"
                kind="gold"
                title="قيّم الفيديو"
                onPress={() => router.push({ pathname: '/rate', params: { vid: video.id, title: script.title } })}
              />
              <IconButton icon="share-outline" kind="ghost" title="شارك" onPress={() => void Share.share({ message: `${script.title}\n${url}` })} />
            </View>
            {error && <Notice tone="bad">{error}</Notice>}
            {script.approved ? (
              video.preview && <Button title="أنشئ الفيديو النهائي" busy={busy} onPress={onFinal} />
            ) : (
              <Button title="التالي: الاعتماد" onPress={onNext} />
            )}
          </>
        )}
      </View>

      {others.length > 0 && (
        <Collapsible title={`فيديوهات سابقة لهذه النسخة (${others.length})`} style={{ borderRadius: 18 }}>
          {others.map((v) => {
            const wide = (templates.find((t) => t.id === v.template)?.aspect ?? (tall ? '9:16' : '16:9')) === '16:9'
            return (
              <Pressable
                key={v.id}
                accessibilityRole="button"
                accessibilityLabel={`اعرض ${v.preview ? 'المعاينة' : 'الفيديو النهائي'} بقالب ${templates.find((t) => t.id === v.template)?.name ?? v.template}`}
                onPress={() => onShow(v.id)}
                style={({ pressed }) => [st.other, pressed && { opacity: 0.7 }]}
              >
                <View style={[st.thumb, wide ? { width: 96, height: 54 } : { width: 54, height: 96 }]}>
                  {v.frames[0] && <Image source={{ uri: BASE + v.frames[0] }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={st.otherTitle}>
                    {v.preview ? 'معاينة' : 'نهائي'} · {templates.find((t) => t.id === v.template)?.name ?? v.template}
                  </Text>
                  {v.preview && <Badge tone="warn">بعلامة مائية</Badge>}
                  <Text style={st.otherMeta}>
                    {shortDate(v.created_at)}
                    {v.duration_seconds != null ? ` · ${Math.round(v.duration_seconds)} ث` : ''}
                  </Text>
                </View>
              </Pressable>
            )
          })}
        </Collapsible>
      )}

      <LinkButton title="اصنع فيديو بقالب آخر" onPress={onOther} />
    </>
  )
}

const st = StyleSheet.create({
  bleed: { marginHorizontal: -16 },
  chips: { gap: 8, paddingHorizontal: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.surface },
  chipOff: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  chipOn: { backgroundColor: C.brand, borderColor: C.brand, borderStyle: 'solid' },
  chipText: { fontFamily: F.semibold, fontSize: 13, color: C.ink },
  lockChip: { position: 'absolute', bottom: 10, end: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(20,32,28,0.85)' },
  lockText: { fontFamily: F.semibold, fontSize: 11, color: '#fff' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: -4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.line },
  dotOn: { width: 18, backgroundColor: C.brand },
  nowName: { fontFamily: F.bold, fontSize: 20, color: C.ink },
  nowFacts: { fontFamily: F.semibold, fontSize: 12, color: C.muted },
  nowDesc: { fontFamily: F.regular, fontSize: 14, lineHeight: 23, color: C.ink },
  nowOther: { fontFamily: F.semibold, fontSize: 13, color: C.warn },
  why: { fontFamily: F.semibold, fontSize: 13, lineHeight: 21, color: C.warn },
  chosen: { fontFamily: F.bold, fontSize: 14, color: C.brand },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  scene: { flexDirection: 'row', gap: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 12 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  refSource: { fontFamily: F.semibold, fontSize: 12, color: C.ok },
  onScreen: { fontFamily: F.regular, fontSize: 12, lineHeight: 18, color: C.muted },
  section: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, gap: 14 },
  failed: { alignItems: 'center', borderColor: '#f0c9c3' },
  pair: { flexDirection: 'row', gap: 8 },
  renderHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  renderTitle: { flex: 1, fontFamily: F.bold, fontSize: 16, color: C.ink },
  renderTime: { fontFamily: F.regular, fontSize: 13, color: C.muted },
  bar: { height: 6, borderRadius: 3, backgroundColor: C.line, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: C.brand },
  stage: { fontFamily: F.regular, fontSize: 14, lineHeight: 22, color: C.muted },
  other: { flexDirection: 'row', gap: 12, minHeight: 54, paddingVertical: 4 },
  thumb: { borderRadius: 10, backgroundColor: '#10241e', overflow: 'hidden' },
  otherTitle: { fontFamily: F.semibold, fontSize: 14, color: C.ink },
  otherMeta: { fontFamily: F.regular, fontSize: 12, color: C.muted },
})
