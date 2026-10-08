"""The pack sent to a religious specialist: review links for a sample of real scripts on balagh.space, and the
message to send with them. Each link opens the reviewer page in the scholar's role; the decision (sign, or ask
for changes with a note) is recorded on that version with the reviewer's name.

    ADMIN_TOKEN=… uv run python tools/review_pack.py   # prints the message and the links, writes eval/review_pack.md

Each link carries a scholar's invitation issued by the admin: without it the page is for reading only. Running
the pack again issues new invitations; the earlier links keep working.

The sample mixes what a scholar should see: plain topics (levels A and B), two disputed matters (level C), a
localized version, a children's story, and one older version where the automatic reviewers found real
problems, to see whether the scholar agrees with them.
"""
import os
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://balagh.space"
OUT = ROOT / "eval" / "review_pack.md"

# (project, script, why it is in the sample)
SAMPLE = [
    ("7cd661d29fb647f493cf2da8f7398344", "06c29db5", "موضوع عام (أ): الصدق في البيع، آية وحديثان"),
    ("ff4c8bc6261c4912bb6efd58d40fd75e", "f252b943", "موضوع عام (أ): إن مع العسر يسرا، 30 ثانية"),
    ("1e4f8c5f5e664735a08d1133a732aab4", "14510364", "شرح واستدلال (ب): بر الوالدين"),
    ("ad2e06d39d06454d95e9651b28b8bb76", "6ce722c0", "شرح (ب) من محاضرة على يوتيوب: التوحيد في المعاملات"),
    ("c69a9fdac8d64e9bbac1c88690393936", "76c7aea1", "شرح (ب): الصبر عند الصدمة الأولى، آية وحديثان"),
    ("c5891792539d446a9590cadc6f90a444", "ed2d614a", "مسألة خلافية (ج): حكم الموسيقى"),
    ("16145b6471964a60ad5e18b47cc8d538", "fbe9999c", "مسألة خلافية (ج): الاحتفال بالمولد النبوي"),
    ("c69a9fdac8d64e9bbac1c88690393936", "cd6b0ff7", "نسخة موطّنة إلى الإنجليزية: هل بقي المعنى؟"),
    ("73170d0a85cc4027b9c9c8aa936bcf06", "2bb87cf9", "قصة أطفال بشخصيات ثابتة: هل بسّطت دون تحريف؟"),
    ("b9a85c8e81ed429882428d892a80fdca", "80b1216c", "نسخة قديمة وجد فيها المراجع الآلي 5 ملاحظات مانعة: هل توافقونه؟"),
]

MESSAGE = """السلام عليكم ورحمة الله.

بلاغ أداة تكتب سيناريوهات دعوية قصيرة بالذكاء الاصطناعي، والآية والحديث فيها تُؤخذ حرفيًّا من المصحف والصحيحين، فلا تحتاجون التحقق منهما. المطلوب منكم مراجعة **الشرح** فقط، في {n} سيناريوهات، نحو 3 دقائق لكل واحد:

- هل النسبة إلى الله ورسوله ﷺ صحيحة؟
- هل الشرح موافق للتفسير أو شرح الحديث المرفق تحت كل نص، ولا يتجاوزه؟
- هل فيه خلاف قُدّم على أنه قطعي، أو انزلاق نحو الفتوى، أو ما لا يليق؟

كل رابط يفتح صفحة فيها الفيديو إن وُجد، والنصوص مع تفسيرها وشرحها، والسيناريو، وملاحظات المراجع الآلي. وفي آخر الصفحة زرّان: «أعتمد هذه النسخة» أو «أطلب تعديلًا» مع كتابة ما يلزم تغييره، والتوقيع باسمكم وصفتكم.

ملاحظاتكم وتوقيعاتكم ستُنشر مع نتائج تقييم المشروع باسمكم، إن أذنتم؛ وإن لم تأذنوا ذُكرت الصفة فقط. وإن استغرق أحد السيناريوهات أكثر من خمس دقائق فاكتبوا ذلك في الملاحظة، فالوقت من ما نقيسه.

جزاكم الله خيرًا.

{links}"""


def main() -> None:
    lines, rows = [], []
    for n, (pid, sid, why) in enumerate(SAMPLE, start=1):
        p = httpx.get(f"{SITE}/api/projects/{pid}", timeout=60).json()
        s = p["scripts"][sid]
        token = httpx.post(f"{SITE}/api/admin/projects/{pid}/invites", params={"role": "scholar"}, timeout=60,
                           headers={"Authorization": f"Bearer {os.environ['ADMIN_TOKEN']}"}).raise_for_status().json()["token"]
        url = f"{SITE}/#/review/{pid}/{sid}/scholar/{token}"
        time.sleep(3.5)  # the site accepts 20 writes a minute
        lines.append(f"{n}. {why}\n   {url}")
        rows.append(f"| {n} | {s['title']} | {s['content_level']} | {s['target']['language']} | {why} | {url} |")
    message = MESSAGE.format(n=len(SAMPLE), links="\n".join(lines))
    print(message)
    OUT.write_text("# حزمة المراجعة الشرعية\n\nالعينة المرسلة للمختصين الشرعيين، بروابط صفحة المراجع بدور «مراجع شرعي». القرارات تُسجَّل على النسخ نفسها؛ كل رابط يحمل دعوة مراجع شرعي تصدرها الإدارة، وبدونها تكون الصفحة للاطلاع فقط. `tools/review_report.py` يجمعها.\n\n| # | السيناريو | المستوى | اللغة | لماذا في العينة | الرابط |\n|---|---|---|---|---|---|\n" + "\n".join(rows) + "\n\n## الرسالة\n\n" + message + "\n")
    print(f"\n→ {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
