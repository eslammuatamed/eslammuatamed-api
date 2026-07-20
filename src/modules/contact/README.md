# `contact` — نموذج التواصل + صندوق الرسائل

> يتبع الشكل القانوني في [`src/modules/README.md`](../README.md). هنا ما يخصّها فقط.

## المسؤولية

نقطة التحويل الوحيدة للمنصّة: استقبال عامّ لرسائل التواصل (`POST /api/v1/contact`) مع طبقتَي مكافحة سبام
خفيفتَين، وصندوق وارد إداري للقراءة والفرز فقط (`/api/v1/admin/messages`). لا ردّ ولا إنشاء إداري (`D02-4`).
الرسائل المقبولة تُحفَظ في جدول `contact_messages`.

## خريطة الملفّات

| الملف | الدور |
|---|---|
| `contact.controller.ts` | `POST /api/v1/contact` عامّ (`@Public`) + `@UseGuards(ContactThrottlerGuard)` |
| `messages.admin.controller.ts` | `GET /api/v1/admin/messages` · `GET :id` (`messages.read`) · `PATCH :id` (`messages.update`) |
| `contact.service.ts` | مكافحة السبام + `meta` + الترقيم (unread-first) + الفرز |
| `anti-spam.ts` | مُساعد نقيّ `isSpam(...)` — مصيدة العسل + فخّ الزمن |
| `dto/*` · `entities/*` | مدخلات الطلب + أشكال الردّ (Swagger) |

## خريطة الاتصال

- **يعتمد على:** `PrismaService` فقط (لا `LocalesService` — الرسائل مستقلّة عن اللغة).
- **`ContactThrottlerGuard`** مُسجَّل كـ provider ليُشغَّل `onModuleInit` (بناء نافذتَي المعدّل) ويُحلّ من
  DI عند `@UseGuards` — نفس أسلوب `UploadUserIpThrottlerGuard` في `MediaModule` (`T2`).

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

## العقود والثوابت

- التحكّم بالمعدّل route-local عبر `ContactThrottlerGuard` (3/ساعة + 10/يوم لكلّ IP، `429` + `Retry-After`).
- كلّ نقطة إدارية تُعلن `messages.read`/`messages.update`؛ **لا مفتاح `messages.create`** (محجوز غير مُستخدَم).
- كلّ رد يمرّ بالغلاف الموحّد (`{ data }` / `{ data, meta }`)، وكلّ DTO/كيان مُزيَّن بالكامل.
- الأخطاء بصيغة RFC 7807 (problem+json): `422` للتحقّق، و`404` لرسالة غير موجودة في القراءة/التحديث الإداريّين.
- خصوصيّة وتسجيل: **لا مفهوم رمز/توكن هنا**؛ حقلا مكافحة السبام (`website`/`elapsedMs`) طلبيّان فقط **ولا يُحفظان أبدًا**، والمحفوظ من الترويسات هو `meta = { userAgent, referrer }` فقط (كائن فارغ `{}` عند الغياب).

## القيود المقبولة والمؤجَّل

- **لا إنشاء ولا ردّ إداريّ** (`D02-4`): الرسالة تُنشأ حصرًا عبر الاستقبال العام؛ مفتاح `messages.create` محجوز غير مُستخدَم، والصندوق قراءة + فرز فقط.
- **تطهير الرسائل بعد ١٢ شهرًا مؤجَّل إلى F005** — لا حذف دوريّ في F004.

## الاختبارات

`contact.service.spec.ts` (Prisma مُموَّه) · `anti-spam.spec.ts` (حدود المصيدتَين) ·
`create-contact-message.dto.spec.ts` (تفاعل البوابة: الفخّ لا يُنتج 422، والحقل المجهول يُرفَض) ·
`contact.controller.spec.ts` (تطابق الإيصال محفوظ/مُسقَط + ميتاداتا الصلاحيات) · `test/contact.e2e-spec.ts` (`T9`).

## المرجع الرسمي وحالة التوافق

- [NestJS — Rate Limiting (`@nestjs/throttler`)](https://docs.nestjs.com/security/rate-limiting) ·
  [Validation](https://docs.nestjs.com/techniques/validation) ·
  [Prisma — pagination & filtering](https://www.prisma.io/docs/orm/prisma-client/queries/pagination).

**حالة التوافق:** `Compatible`. **لا انحراف.**
