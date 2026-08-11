# `contact` — نموذج التواصل + صندوق الرسائل

> يتبع الشكل القانوني في [`src/modules/README.md`](../README.md). هنا ما يخصّها فقط.

## المسؤولية

نقطة التحويل الوحيدة للمنصّة: استقبال عامّ لرسائل التواصل (`POST /api/v1/contact`) مع طبقتَي مكافحة سبام
خفيفتَين، وصندوق وارد إداري للقراءة والفرز (`/api/v1/admin/messages`) **وللردّ بالبريد** (`D02-13`، ينقض
شقّ الردّ من `D02-4`). لا إنشاء إداري. الرسائل المقبولة تُحفَظ في `contact_messages`، ومحاولات الردّ في
`contact_message_replies`.

**الإرسال الفعليّ مُنفَّذ**: الردّ يُحفَظ ثمّ يُسلَّم عبر ناقل البريد، وتُسجَّل النتيجة في حالة الصفّ
(`SENT` / `FAILED` / `PENDING`). حالة النضج بدقّة — وهي ثلاث جُمَل منفصلة عمدًا:
`Reply backend ready: YES` · `Reply frontend UI: NO` (لا واجهة في `/dashboard` تستهلكه) ·
`Reply Production deployed: NO`.

## خريطة الملفّات

| الملف | الدور |
|---|---|
| `contact.controller.ts` | `POST /api/v1/contact` عامّ (`@Public`) + `@UseGuards(ContactThrottlerGuard)` |
| `messages.admin.controller.ts` | `GET /api/v1/admin/messages` · `GET :id` · `GET :id/replies` (`messages.read`) · `PATCH :id` (`messages.update`) · `POST :id/replies` (`messages.reply`) |
| `contact-reply.service.ts` | نطاق الردّ: الحفظ، ومنع التكرار (`Idempotency-Key`)، وآلة الحالة `PENDING`→`SENT`/`FAILED` + مسار التعافي. يُنسّق التسليم ولا **يبنيه**: بناء الرسالة وإرسالها في `contact-mail.service.ts` |
| `idempotency-key.pipe.ts` | التحقّق من ترويسة `Idempotency-Key` كـ pipe، أي **قبل** أيّ قراءة من قاعدة البيانات |
| `reply-subject.ts` | اشتقاق `Re: <الموضوع>` دون تكرار البادئة |
| `provider-idempotency.ts` | اشتقاق مفتاح تكرار **المزوّد** (`contact-reply/<id>`) وحساب نافذة الـ 24 ساعة |
| `message-not-repliable.exception.ts` | `409` لرسالة بلا بريد (`D02-10` يسمح برقم هاتف وحده) |
| `contact.service.ts` | مكافحة السبام + `meta` + الترقيم (unread-first) + الفرز + ضبط `archivedAt` عند الأرشفة + `purgeArchivedOlderThan` |
| `contact-purge.scheduler.ts` | مهمّة `@Cron` يوميّة داخل العمليّة (`D07-3`): حذف نهائيّ للرسائل المؤرشفة منذ أكثر من ١٢ شهرًا (`D19-10`) |
| `contact-mail.service.ts` | **محتوى** بريدَي الاستقبال (إشعار المالك + إقرار الزائر) وإرسالهما بعد الحفظ، **و`dispatchReply`** الذي يبني رسالة الردّ ويُسلّمها حاملةً مفتاح تكرار المزوّد |
| `anti-spam.ts` | مُساعد نقيّ `isSpam(...)` — مصيدة العسل + فخّ الزمن |
| `dto/*` · `entities/*` | مدخلات الطلب + أشكال الردّ (Swagger) |

## خريطة الاتصال

- **يعتمد على:** `PrismaService` + `MailModule` (لا `LocalesService` — الرسائل مستقلّة عن اللغة).
- **`ContactThrottlerGuard`** مُسجَّل كـ provider ليُشغَّل `onModuleInit` (بناء نافذتَي المعدّل) ويُحلّ من
  DI عند `@UseGuards` — نفس أسلوب `UploadUserIpThrottlerGuard` في `MediaModule` (`T2`).
- **`ContactPurgeScheduler`** مُسجَّل كـ provider ليكتشف `ScheduleModule` (المُسجَّل في `AppModule`) مُعالِج
  `@Cron` الخاصّ به — نفس أسلوب `ArticlesScheduler` في `ArticlesModule` (`D07-3`).

## الاحتفاظ والتطهير (F005 — `D09-14` / `D19-10`)

يُنفِّذ وعد doc 19 §6: «الرسائل تُطهَّر بعد ١٢ شهرًا من الأرشفة».

- **`archivedAt` (عمود `DateTime?` قابل للتصفير، `D09-14`):** أساس الاحتفاظ. تضبطه `ContactService.update`
  على اللحظة الحاليّة عند الأرشفة (`isArchived` من `false` إلى `true`)، وتُصفّره إلى `null` عند إلغاء
  الأرشفة (`true` إلى `false`)، ولا تمسّه إذا لم يتغيّر `isArchived`. **مُدار من الخادم**؛ لا يُقبل من الـ DTO.
- **لماذا عمود مخصَّص لا `updatedAt`؟** `@updatedAt` تعني «آخر تعديل» (تبديل `isRead` أو إعادة الأرشفة يحرّكها)،
  فتُعيد تعريف نافذة الاحتفاظ ضمنًا وقد تحذف بيانات الزائر مبكّرًا أو متأخّرًا (`AD-1`). العمود المخصَّص هو
  الأساس الدقيق القابل للتدقيق، إضافيّ (بلا backfill، بلا فهرس جديد — جدول صغير ومهمّة يوميّة، مبدأ ١٥).
- **`purgeArchivedOlderThan(cutoff)`:** حذف نهائيّ (`deleteMany`) حيث
  `isArchived = true AND archivedAt != null AND archivedAt < cutoff`؛ يُرجِع العدد فقط. الصفوف غير المؤرشفة
  (`archivedAt = null`) والمؤرشفة حديثًا محفوظة دائمًا.
- **`ContactPurgeScheduler`:** `@Cron(EVERY_DAY_AT_MIDNIGHT)` داخل العمليّة، نسخة واحدة (`D07-3`). يحسب
  `cutoff = now − 12 شهرًا` (حدّ صارم `<`: المؤرشف قبل ١٢ شهرًا بالضبط يبقى)، ويُسجّل **العدد فقط** — لا
  محتوى رسالة أبدًا (`name/email/subject/body` بيانات شخصيّة، `D07-5`). `@nestjs/schedule` يلفّ المُعالِج
  بـ try/catch، فخطأ قاعدة بيانات عابر يُسجَّل ويُعاد في الدورة التالية دون إسقاط العمليّة.
- **الهجرة إضافيّة فقط** (`ADD COLUMN archived_at`)، مكتوبة يدويًّا (لا `prisma migrate dev` — لأنّه سيحاول
  إسقاط عمود الـ FTS المُولَّد `search_vector`، `D09-6`). طُبِّقت على قاعدة الاختبار؛ **هجرة الإنتاج مؤجَّلة
  تحت تجميد الإصدار** (`D17-5`/`D23-18`).

## ما يميّز هذه الوحدة عن النموذج

- **إسقاط-كنجاح (drop-as-success):** سبام مُكتشَف ⇒ نفس إيصال 2xx بالضبط دون حفظ أيّ شيء. الإيصال
  ثابت (`{ data: { received: true } }`) وبلا `id` — لا يميّز رسالة حقيقيّة عن مُسقَطة، فلا يتسرّب أيّ
  إشارة للبوت (`FR-004-02`).
- **تفاعل الـ ValidationPipe (حرج):** البوابة العامّة `whitelist + forbidNonWhitelisted + transform`،
  لذا حقلا مكافحة السبام (`website` مصيدة العسل، `elapsedMs` فخّ الزمن) **مُعلَنان** في الـ DTO (وإلّا
  رفض حقلٍ مجهول = 422 مميِّز)، لكن **متساهلان** (`website` بلا `@MaxLength`، `elapsedMs` بلا `@Min`) كي
  يصل الفخّ المُفعَّل إلى الخدمة فتُسقِطه، لا أن ترفضه البوابة بـ 422 يفضح المصيدة (`D02-1`، `D05-4`).
- **الحقول الحقيقيّة مُتحقَّق منها بصرامة:** `name`/`subject`/`body` بـ `@IsString` + `@MinLength(1)` + `@MaxLength` (200/300/5000 على الترتيب)، و`email` بـ `@IsEmail` + `@MaxLength(320)`؛ أيّ إخفاق ⇒ `422` بصيغة problem+json (RFC 7807).
- **`elapsedMs` مدّة منقضية لا طابع زمني مطلق:** ساعة عميل منحرفة لا تُسقِط رسالة حقيقيّة (`D05-4`).
  عتبة `MIN_FILL_MS = 3000`؛ غائب/سالب/أقلّ من العتبة ⇒ سبام.
- **حقلا السبام لا يُحفظان أبدًا؛** فقط `name/email/subject/body` تُكتَب، و`meta = { userAgent, referrer }`
  من الترويسات (كائن فارغ `{}` عند الغياب).
- **`POST /api/v1/contact` يُرجِع 200** لا 201: قد تُسقَط الرسالة، فـ"أُنشئت" كذب — والإيصال موحّد للحالتَين.
- **الترتيب: غير المقروء أوّلًا** (`ORDER BY isRead ASC, createdAt DESC`) مدعومًا بـ
  `@@index([isArchived, isRead, createdAt])`.

- **البريد أثرٌ جانبيّ لكتابةٍ مؤكَّدة، بهذا الترتيب حصرًا:** تحقّق ⇒ **حفظ في قاعدة البيانات** ⇒ إرسال.
  السجلّ هو الأثر الرسميّ، فإخفاق SMTP **لا يُسقِط ولا يرفض** رسالة حُفظت، والزائر يأخذ إيصاله فور
  تأكيد الصفّ. الإرسال **غير مُنتظَر** (`void … .catch`) كي لا تدخل حلقة إعادة المحاولة داخل طلب
  الزائر. المُسقَط كسبام يرجع **قبل** الحفظ، فلا يُرسَل له شيء — وإلّا لصارت المصيدة مُضخِّم بريد.
- **إقرار الزائر بالإنجليزيّة دائمًا (قيد موثَّق):** الاستقبال **لا يحمل أيّ إشارة لغة** — لا في
  `CreateContactMessageDto` ولا في `ContactIntakeContext` (ترويسات فقط: `user-agent` و`referer`).
  استنتاجها من `/ar/` في المُحيل أو من `Accept-Language` اختراعُ إشارةٍ لا يحملها العقد، والقاعدة
  «لا سقوط لغويّ صامت». تعريب الإقرار يستلزم حقل `locale` صريحًا في الـ DTO، وهو **تغيير عقد**
  يخضع لـ`doc 16 §3`.

## العقود والثوابت

- التحكّم بالمعدّل route-local عبر `ContactThrottlerGuard` (3/ساعة + 10/يوم لكلّ IP، `429` + `Retry-After`).
- كلّ نقطة إدارية تُعلن `messages.read`/`messages.update`/`messages.reply`؛ **لا مفتاح `messages.create`**.
- **المستقبِل لا يختاره العميل أبدًا** (`D19-12`): يُشتقّ خادميًّا من `ContactMessage.email` للرسالة المُعنونة،
  و`CreateMessageReplyDto` لا يحمل أيّ حقل مستقبِل — فأيّ `to`/`cc`/`bcc` في الجسم يُرفَض بـ `422` (لا يُحذَف
  صامتًا)، لأنّ الأنبوب العامّ يعمل بـ `whitelist` + `forbidNonWhitelisted`.
- **منع التكرار في قاعدة البيانات** عبر `@@unique([contactMessageId, idempotencyKey])`: مفتاح واحد ⇒ محاولة
  منطقيّة واحدة. المفتاح مقصور على الرسالة وليس عامًّا، وإلّا لأعاد مفتاحٌ استُخدم مع رسالة أخرى صفَّ **تلك**
  الرسالة. `201` عند الإنشاء و`200` عند إعادة التشغيل — لأنّ إعادة التشغيل لم تُنشئ موردًا.
- كلّ رد يمرّ بالغلاف الموحّد (`{ data }` / `{ data, meta }`)، وكلّ DTO/كيان مُزيَّن بالكامل.
- الأخطاء بصيغة RFC 7807 (problem+json): `422` للتحقّق، و`404` لرسالة غير موجودة في القراءة/التحديث الإداريّين.
- خصوصيّة وتسجيل: **لا مفهوم رمز/توكن هنا**؛ حقلا مكافحة السبام (`website`/`elapsedMs`) طلبيّان فقط **ولا يُحفظان أبدًا**، والمحفوظ من الترويسات هو `meta = { userAgent, referrer }` فقط (كائن فارغ `{}` عند الغياب).

## القيود المقبولة والمؤجَّل

- **لا إنشاء إداريّ**: الرسالة تُنشأ حصرًا عبر الاستقبال العام؛ مفتاح `messages.create` محجوز غير مُستخدَم.
- **الردّ الإداريّ مُتاح الآن** (`D02-13`) بعد أن كان مرفوضًا في `D02-4`، **ومع تسليم فعليّ**: الصفّ يُنشأ
  `PENDING` ثمّ يُحسَم إلى `SENT` أو `FAILED` حسب ما يُقرّه الناقل. وتبقى `PENDING` صادقة عمدًا حين تلزم —
  فهي تعني «لم تُسجَّل نتيجة نهائيّة»، لا «لم يُسلَّم شيء»؛ والغموض ليس فشلًا.
- **خارج النطاق قصدًا**: لا استقبال بريد وارد، ولا IMAP، ولا webhooks، ولا سلاسل محادثة، ولا مرفقات، ولا HTML،
  ولا `CC`/`BCC`، ولا إرسال جماعي أو مجدول، ولا أيّ مسار إرسال لمستقبِل حرّ في الـ API كلّه.
- **تطهير الرسائل بعد ١٢ شهرًا مُنفَّذ في F005** (قسم «الاحتفاظ والتطهير» أعلاه، `D19-10`) — استبدل تأجيل F004.

## الاختبارات

`contact.service.spec.ts` (Prisma مُموَّه — يشمل مصفوفة انتقال `archivedAt` وحدود `purgeArchivedOlderThan`) ·
`contact-purge.scheduler.spec.ts` (حدّ `retentionCutoff` ١٣/١٢/١١ شهرًا + تفويض المجدول + تسجيل العدد فقط بلا PII) ·
`anti-spam.spec.ts` (حدود المصيدتَين) ·
`create-contact-message.dto.spec.ts` (تفاعل البوابة: الفخّ لا يُنتج 422، والحقل المجهول يُرفَض) ·
`contact.controller.spec.ts` (تطابق الإيصال محفوظ/مُسقَط + ميتاداتا الصلاحيات).

وللردّ تحديدًا — **وحدات:** `contact-reply.service.spec.ts` (آلة الحالة كاملة، Prisma مُموَّه) ·
`provider-idempotency.spec.ts` (شكل المفتاح + حدّا النافذة بالمللي ثانية) · `reply-subject.spec.ts` ·
`idempotency-key.pipe.spec.ts` · `dto/create-message-reply.dto.spec.ts`.
**e2e:** `test/contact.e2e-spec.ts` · `test/contact-retention.e2e-spec.ts` (انتقال `archivedAt` عبر HTTP +
التطهير على Postgres) · `test/message-replies.e2e-spec.ts` · `test/reply-delivery.e2e-spec.ts` ·
`test/reply-http-delivery.e2e-spec.ts` (مصفوفة التسليم عبر HTTP، ومنها سباق حقيقيّ بحاجز على فهرس الفرادة) ·
`test/reply-http-security.e2e-spec.ts` (تهريب المستلِم، مصفوفة الصلاحيات، النافذة، والسجلّ).

## المرجع الرسمي وحالة التوافق

- [NestJS — Rate Limiting (`@nestjs/throttler`)](https://docs.nestjs.com/security/rate-limiting) ·
  [Validation](https://docs.nestjs.com/techniques/validation) ·
  [Prisma — pagination & filtering](https://www.prisma.io/docs/orm/prisma-client/queries/pagination).

**حالة التوافق:** `Compatible`. **لا انحراف.**
