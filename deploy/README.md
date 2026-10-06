# نشر بلاغ

الموقع الحي: https://balagh.space (النشر الأول كان على balagh.findapply.com؛ الخطوات نفسها بتغيير اسم النطاق)

## ما هو منشور على الخادم

| العنصر | التفاصيل |
|---|---|
| الكود | `/var/www/balagh` |
| الـ API | خدمة systemd باسم `balagh-api`، تستمع على `127.0.0.1:8610`، وتشتغل تلقائيا بعد إعادة تشغيل الخادم |
| الواجهة | مبنية في `web/dist`، ويعرضها nginx |
| الروابط | الواجهة على `/`، والـ API على `/api/` (توثيقه على `/api/docs`) |
| HTTPS | شهادة Let's Encrypt، وطلبات HTTP تُحوَّل إلى HTTPS |
| البيانات | SQLite في `data/balagh.db`. قرص الخادم دائم، فالمشاريع تبقى بعد إعادة التشغيل |
| المهلة | 5 دقائق لطلبات الـ API في nginx، لأن التوليد قد يستغرق دقيقة |
| حدّ الطلبات | 20 طلب توليد في الدقيقة لكل زائر، و240 للواجهة، و10 اتصالات متزامنة. الزونات في `/etc/nginx/conf.d/balagh-ratelimit.conf` |

الملفات المستعملة موجودة في هذا المجلد:

- `balagh-api.service`: يُنسخ إلى `/etc/systemd/system/`.
- `nginx.conf`: يُنسخ إلى `/etc/nginx/sites-available/balagh.findapply.com` ويُربط في `sites-enabled`.
- `ratelimit.conf`: يُنسخ إلى `/etc/nginx/conf.d/balagh-ratelimit.conf`، لأن زونات الحدّ تُعرَّف في كتلة `http` قبل أن يستعملها الموقع.

> ملف `nginx.conf` هنا بلا HTTPS: شهادة Let's Encrypt أضافها certbot إلى النسخة الحيّة. فلا يُنسخ هذا الملف فوق الحيّة بعد إصدار الشهادة، بل تُعدَّل الحيّة موضعيا.

## الإعدادات على الخادم

ملف `/var/www/balagh/.env` (غير موجود في المستودع):

```
GEMINI_API_KEY=...
MAGNIFIC_API_KEY=...
ADMIN_TOKEN=...   # قيمة طويلة عشوائية، تفتح /#/admin
CORS_ORIGINS=https://balagh.findapply.com
```

## ملاحظات من نشر balagh.space

- مفسّر Python الذي يثبّته `uv` يقع تحت `/root` فلا تصل إليه الخدمة التي تعمل باسم `www-data`. يُثبَّت في مكان مشترك: `UV_PYTHON_INSTALL_DIR=/opt/uv-python uv python install 3.12` ثم `uv sync -p 3.12`، مع `chmod -R o+rX /opt/uv-python`.
- في ملف الخدمة `Environment=HOME=/var/www/balagh` و`TimeoutStartSec=180`: تحميل بيانات التفسير والشرح يأخذ ثواني عند الإقلاع، وRemotion يكتب في `$HOME`.
- `git config --global --add safe.directory /var/www/balagh` قبل `git pull` بصفة root في مجلد يملكه `www-data`.
- حصة Gemini TTS في الطبقة المجانية 10 طلبات في الدقيقة لكل نموذج؛ الخط يراعيها (مقطعان في وقت واحد وانتظار ما تطلبه الواجهة)، فحلقة الأطفال تأخذ نحو 3.5 دقائق.

## متطلبات الفيديو على الخادم (مرة واحدة)

```bash
ssh FindApply 'apt-get install -y ffmpeg fonts-noto-color-emoji \
  && cd /var/www/balagh/video && npm ci --silent && npx remotion browser ensure'
```

`fonts-noto-color-emoji` لازم: بدونه تظهر الرموز التعبيرية في قالب الترجمة المتحركة مربعات فارغة.

بعد تغيير أي قيمة فيه:

```bash
ssh FindApply 'systemctl restart balagh-api'
```

## تحديث الموقع

المستودع خاص، فلا يعمل `git pull` على الخادم. يُرسل الكود من الجهاز المحلي عبر SSH:

```bash
git push ssh://FindApply/var/www/balagh main
ssh FindApply 'cd /var/www/balagh \
  && .venv/bin/pip install -q -r requirements.txt \
  && cd web && npm ci --silent \
  && VITE_API_URL=https://balagh.findapply.com/api npm run build \
  && systemctl restart balagh-api'
```

إذا تغيرت الاعتمادات في `pyproject.toml`، أعد توليد `requirements.txt` قبل الرفع:

```bash
uv export --no-hashes --no-emit-project -o requirements.txt
```

بعد أن يصبح المستودع عاما يمكن استعمال `git pull` على الخادم بدل الدفع عبر SSH.

## النشر من الصفر

```bash
# 1. الكود
ssh FindApply 'git init -q -b main /var/www/balagh \
  && git -C /var/www/balagh config receive.denyCurrentBranch updateInstead'
git push ssh://FindApply/var/www/balagh main

# 2. الاعتمادات وبناء الواجهة
ssh FindApply 'cd /var/www/balagh \
  && python3 -m venv .venv && .venv/bin/pip install -q -r requirements.txt \
  && cd web && npm ci --silent \
  && VITE_API_URL=https://balagh.findapply.com/api npm run build'

# 3. ملف .env (انظر أعلاه)، ثم صلاحيات مجلد البيانات
ssh FindApply 'chown -R www-data:www-data /var/www/balagh/data \
  && chown root:www-data /var/www/balagh/.env && chmod 640 /var/www/balagh/.env'

# 4. الخدمة
ssh FindApply 'cp /var/www/balagh/deploy/balagh-api.service /etc/systemd/system/ \
  && systemctl daemon-reload && systemctl enable --now balagh-api'

# 5. nginx والشهادة
ssh FindApply 'cp /var/www/balagh/deploy/nginx.conf /etc/nginx/sites-available/balagh.findapply.com \
  && ln -s /etc/nginx/sites-available/balagh.findapply.com /etc/nginx/sites-enabled/ \
  && nginx -t && systemctl reload nginx \
  && /opt/certbot/bin/certbot --nginx -d balagh.findapply.com --non-interactive --redirect'
```

## التحقق بعد النشر

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://balagh.findapply.com/
curl -s -o /dev/null -w '%{http_code}\n' https://balagh.findapply.com/api/openapi.json
ssh FindApply 'systemctl is-active balagh-api; journalctl -u balagh-api -n 20 --no-pager'
```

## ملاحظات

- الـ API يحتاج نحو 8 ثوان بعد التشغيل ليحمّل بيانات القرآن والصحيحين، وخلالها يرفض الاتصال.
- `certbot` المثبت عبر النظام (`/usr/bin/certbot`) معطل على هذا الخادم بسبب تعارض في مكتبات Python. استُعملت النسخة الموجودة في `/opt/certbot`، وهي التي تجدد شهادات بقية المواقع.
- الموقع مفتوح بلا حماية، فكل من يملك الرابط يستهلك من حصة مفتاح Gemini. يُراقَب الاستهلاك خلال فترة التحكيم.
- للنشر على خادم قرصه غير دائم (مثل الخطط المجانية في Render)، يُضبط `DATABASE_URL` على قاعدة Postgres. هذا المسار لم يُجرَّب بعد.
- الخادم يستضيف مواقع أخرى: النشر أضاف ملف nginx واحدا وخدمة واحدة ولم يغيّر غيرهما.
