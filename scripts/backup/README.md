# `scripts/backup` — النسخة المصدرية للنسخ الاحتياطي الخارجي الخاص

> **مُجهَّز لكنه غير مُفعَّل.** البنية الخاصة بالنسخ الخارجي جاهزة: bucket R2 خاص، Lifecycle وBucket
> Lock، اعتماد `rclone` محصور بالخادم، الرافع، هوية SSH المقيّدة، وإعداد GitHub. مع ذلك تبقى
> `BACKUP_OFFSITE_ENABLED=false`: لم يحدث رفع حقيقي لنسخة قاعدة بيانات أو تشغيل مجدول، وP1-1 ليس
> مكتملًا بعد ولا يمنح هذا التجهيز أي تفويض لنشر Production.

## ما يفعله السكربت وما لا يفعله

`offsite-backup.sh` يختار أحدث ملف مكتمل مؤهَّل من
`/srv/backups/postgres/eslammuatamed_prod-*.sql.gz`، ولا يفترض أن «أحدث اسم» يعني ملفًا مكتملًا.
النافذة المقصودة هي عمر **30 دقيقة إلى 24 ساعة**: الحد الأدنى يحمي من ملف cron الذي يكتب مباشرةً
إلى اسمه النهائي، والحد الأقصى يمنع نجاح النسخة الأسبوعية بملف يومٍ قديم. ثم يفحص `gzip -t`،
ويقيس الحجم و`SHA-256`، ويرفع نسخة واحدة فقط، ويعيد قراءتها من R2 إلى الـVPS عبر `rclone cat` قبل
إنشاء ملف الإتمام (`.manifest`). لا تمر بايتات قاعدة البيانات عبر GitHub.

السكربت لا يشغّل `pg_dump`، ولا يعدّل PostgreSQL، ولا يحذف نسخة محلية أو كائن R2، ولا يستدعي
`sync` أو `delete` أو `purge`، ولا يعيد تشغيل خدمة أو يلمس روابط الإصدارات. الاحتفاظ مسؤولية
Lifecycle في R2، لا الرافع.

مفتاح الكائن غير قابل للتبديل:

```text
postgres/eslammuatamed_prod-<UTC-mtime>-<sha256-prefix>.sql.gz
postgres/eslammuatamed_prod-<UTC-mtime>-<sha256-prefix>.sql.gz.manifest
```

الـmanifest هو علامة الإتمام، لا كائن البيانات وحده. محتواه الآمن فقط: الإصدار، اسم المصدر، الحجم،
SHA-256، ووقت الإتمام UTC. إعادة المحاولة آمنة: كائن + manifest مطابقان ينجحان دون رفع جديد؛
كائن بلا manifest يُعاد فحصه ثم يُستكمل manifest؛ وأي اختلاف يفشل مغلقًا.

## حالة تجهيز Phase B/C (غير نشطة)

| المسار                                           | المالك/الوضع المقترح    | الغرض                                                   |
| ------------------------------------------------ | ----------------------- | ------------------------------------------------------- |
| `/usr/local/lib/eslammuatamed/offsite-backup.sh` | `root:deploy`, `0750`   | الرافع المثبّت؛ تنفّذه مجموعة `deploy` ولا تعدّله       |
| `/usr/local/bin/rclone`                          | مثبّت للخادم فقط        | `rclone` v1.75.0 المتعاقد عليه                          |
| `/srv/backups/offsite/offsite.env`               | `deploy:deploy`, `0600` | `OFFSITE_RCLONE_CONFIG` و`OFFSITE_RCLONE_ROOT` فقط      |
| `/srv/backups/offsite/rclone.conf`               | `deploy:deploy`, `0600` | إعداد S3/R2 والاعتماد ذو النطاق المحدود، على الخادم فقط |
| `/srv/backups/offsite/offsite.lock`              | `deploy:deploy`, `0600` | قفل `flock` لمنع التداخل                                |
| `/srv/backups/postgres/`                         | موجود مسبقًا            | مصدر النسخ الليلية؛ لا يعدّله هذا السكربت               |

ملكية `root:deploy` ووضع `0750` مقصودان: يستطيع حساب `deploy` تنفيذ الملف عبر صلاحية المجموعة، لكنه لا يستطيع تعديل برنامج الأمر الإجباري نفسه.

ثُبِّتت نسخة `rclone` **v1.75.0** المطابقة حرفيًا لعقد السكربت، من أرشيف Linux الرسمي للإصدار
المحدد مع تحقق توقيع/مجموع تحقق منشور قبل النقل إلى `/usr/local/bin/rclone`. لا تستخدم
`apt` غير المثبّت، ولا `curl | bash`. صفحة rclone الرسمية تسجل v1.75.0 كالإصدار المستقر الحالي
وتوفر آلية التحقق من التوقيع. [التنزيلات](https://rclone.org/downloads/) ·
[التوقيعات](https://rclone.org/install/#verify-the-download).

الـremote المحلي `backup-r2` في `rclone.conf` يشير إلى **bucket R2 خاص مستقل لقاعدة البيانات**،
وباعتماد S3 Object Read & Write مقصور على ذلك الـbucket. لا يوضع حساب Cloudflare
إداري، ولا حساب R2 أو مفاتيحه في GitHub أو هذا المستودع، ولا CORS أو public domain أو `r2.dev`.
R2 يدعم `PutObject` و`GetObject`؛ فحص البايتات هنا متعمد عبر `cat | sha256sum` بدل افتراض أن
ETag هو MD5. [توافق S3 في R2](https://developers.cloudflare.com/r2/api/s3/api/).

للاحتفاظ، أُعدّ Lifecycle مستقل للبادئة `postgres/` بعمر 56 يومًا وBucket Lock لمدة 55 يومًا.
Cloudflare يذكر أن الإزالة تكون عادةً خلال 24 ساعة من وقت الانتهاء، لذلك لا تعِد «56 يومًا
بالثانية»؛ كما يبقى القفل أقصر من lifecycle حتى لا يؤخر الحذف المقصود. لا تغيّر هذه المرحلة إعداد
R2. [Lifecycle](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
· [Bucket Lock](https://developers.cloudflare.com/r2/buckets/bucket-locks/).

## مفتاح SSH المخصّص

الخيار الموصى به هو **مفتاح مستقل على حساب `deploy` القائم**، لا مستخدم Unix جديد: إدخال
`authorized_keys` مقيّد بـ`restrict,command="/usr/local/lib/eslammuatamed/offsite-backup.sh"`،
ولا يقبل أمر العميل. `restrict` هو primitive OpenSSH المخصص: يمنع PTY وport/agent/X11 forwarding
وتنفيذ `~/.ssh/rc`، ويضم أي قيود مستقبلية يضيفها OpenSSH. أُضيف هذا الإدخال المقيّد بالفعل،
فتظل صلاحيات الملف واضحة وأقل من حساب جديد، مع حد ثقة مستقل عن مفتاح النشر.

تهيئة GitHub تستخدم `BACKUP_SSH_KEY`, `BACKUP_KNOWN_HOSTS`, و`BACKUP_SSH_HOST`,
`BACKUP_SSH_USER`, `BACKUP_SSH_PORT`; ولا تعيد استخدام أسرار `DEPLOY_*`. الاتصال `ssh -T` فقط،
بـ`StrictHostKeyChecking=yes` وknown_hosts مثبّت مسبقًا.

متغير GitHub غير السرّي `BACKUP_OFFSITE_ENABLED` هو بوابة التفعيل الصريحة: لا ينفّذ job
`trigger-vps-backup` ولا ينشئ أي ملف SSH عندما تكون القيمة غائبة أو فارغة أو `false`. يجب أن يبقى
`false` إلى أن يصرّح المالك بأول تشغيل متحكّم به بعد اكتمال تهيئة البنية التحتية.
