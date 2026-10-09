# بلاغ: تطبيق Android

تطبيق Expo أصلي يكلّم واجهة بلاغ البرمجية مباشرة (`https://balagh.space/api`)، بنفس أنواع الموقع وتسمياته.

## التشغيل

```sh
npm install
npx expo start          # امسح الرمز بتطبيق Expo Go، أو اضغط a لمحاكي Android
npm run typecheck
npm run sync            # بعد تعديل web/src/types.ts أو labels.ts أو audiences.ts أو tasks.ts
```

لتوجيهه إلى خادم آخر: `EXPO_PUBLIC_API_URL=http://192.168.1.10:8010 npx expo start`.

## البناء والنشر (EAS)

```sh
npx eas-cli@latest login
npx eas-cli@latest init                                  # يربط المشروع بحساب Expo
npx eas-cli@latest build -p android --profile preview    # ملف APK للتجربة على هاتفك
npx eas-cli@latest build -p android --profile production # ملف AAB لـ Play Store
npx eas-cli@latest submit -p android                     # يرفعه إلى Play Console
```

## التحديث المباشر (OTA)

```sh
npx eas-cli@latest update --channel preview --message "..."     # جرّبه على نسخة التجربة أولا
npx eas-cli@latest update --channel production --message "..."  # ثم للناس
npx eas-cli@latest update:rollback                              # رجوع إن ظهرت مشكلة
```

يصل التحديث إلى النسخ المبنية بنفس `version` في `app.json` فقط. تغيير أصلي (مكتبة أصلية، صلاحية، أيقونة)
يحتاج رفع `version` وبناء جديد في المتجر.
