# `src/modules` — الشكل القانوني للوحدة (module archetype)

هذا الملف يصف **النمط المشترك** لكل وحدات المجال، حتى لا تكرّره ملفات `README.md` لكل وحدة. اقرأه أولًا، ثم اقرأ الوحدة المعنيّة لما يخصّها فقط.

## الوحدات على هذا الأساس (`Shipped`)

`health` · `locales` · `auth` · `users` · `access-control` · `settings` · `taxonomy` · `articles` · `projects` · `experiences` · `skills` · `testimonials` · `redirects` · `contact` · `preview`.

> **`Planned` (غير موجودة على `main`):** `media` (Feature 003)، `seo`. الجداول موجودة في المخطّط، الوحدات لا. لا توجد ملفّات `README.md` لوحدات غير مبنيّة.
>
> ملاحظة: `redirects`/`contact`/`preview` انتقلت إلى `Shipped` مع Feature 004 (ولها ملفّات `README.md`). أمّا `media` (Feature 003) فمُسلَّمة فعليًّا على `main` لكن هذا الفهرس تأخّر عن تحديثها — يُصحَّح في فرع استرجاع توثيقي منفصل (audit Fix #1).

## الشكل الداخلي القانوني

```
<module>/
├── <module>.module.ts            # يربط controllers + providers + imports
├── <module>.controller.ts        # القراءات العامّة (@Public) — إن وُجد سطح عام
├── <module>.admin.controller.ts  # CRUD المحروس (@RequirePermission) — إن وُجد سطح إداري
├── <module>.service.ts           # كل منطق العمل + تحليل اللغة + الـ transactions
├── dto/                          # DTOs للطلبات (class-validator + @nestjs/swagger)
└── entities/                     # أشكال الردّ (مُنمَّطة لـ Swagger)
```

قواعد ملزِمة ([الوثيقة 08](../../../eslammuatamed-docs/docs/08-folder-structure.md)):
- **Controller رفيع، Service سمين:** الـ controller يوجّه ويربط الـ DTO ويحمل decorators الـ Swagger فقط. كل المنطق في الـ service (`principle 13`).
- **تقسيم admin/public داخل الوحدة**، لا كشجرة موازية — يبقى السطح الكامل للكيان في مكان واحد (`D08-2`).
- **تصدير الخدمة فقط عند الحاجة:** وحدة تُصدِّر خدمتها فقط إن احتاجتها وحدة أخرى؛ الـ controllers لا تُصدَّر أبدًا. الوصول لنماذج `Prisma` لوحدة أخرى ممنوع (`D07-1`).

## التدفّق المشترك: القراءة العامّة المُحلّلة للّغة

كل وحدة محتوى عامّة تتبع هذا:

```
GET /<resource>?locale=xx
  → @Public()  (يتخطّى JwtAuthGuard)
  → LocaleQueryDto يتحقّق من صيغة locale
  → Service: await this.locales.assertEnabled(locale)   // لغة غير مُفعّلة → 400
  → استعلام Prisma مع include للترجمة (+ تصفية بالـ locale)
  → resolve*(row, locale): تسطيح الترجمة إلى اللغة الواحدة
  → { data } أو { data, meta }
```

مبدأ حرج: **لا رجوع صامت عبر اللغات.** ترجمة مفقودة تبقى مفقودة — القائمة تُسقِط الصفّ، والوصول المباشر يُعيد 404 (`D05-3`، [الوثيقة 07 §4](../../../eslammuatamed-docs/docs/07-backend-architecture.md)). كل كيان عام يحمل حقل `availableLocales` (اللغات المتوفّرة فعلًا).

## التدفّق المشترك: الكتابة الإدارية

```
POST/PATCH/DELETE /admin/<resource>
  → JwtAuthGuard (default-deny) → PermissionsGuard (@RequirePermission('<resource>.<action>'))
  → @Throttle({ default: THROTTLE_TIERS.admin })
  → ValidationPipe (whitelist + forbid) على الـ DTO
  → Service: assertEnabled لكل لغة ترجمة، ثم كتابة في $transaction
  → القراءة الإدارية تُرجِع خريطة الترجمة الكاملة (لا شكلًا مُحلّلًا)
```

الأنماط المتكرّرة في الـ services:
- `getOrThrow(id)` خاصّ يرمي `NotFoundException` (404) قبل التعديل/الحذف.
- ترجمات تُكتب بـ `upsert` لكل لغة داخل `$transaction` واحد (فشل لغة لا يترك تعديلًا نصف مُطبَّق).
- علاقات many-to-many (tags، technologies، gallery) تُستبدَل كليًّا: `deleteMany` ثم `createMany`.
- الحذف الصلب (hard delete) مع حماية `RESTRICT` على المراجع → `Prisma P2003` → 409 (يعيّنه `AllExceptionsFilter`).

## العقود والثوابت المشتركة

- كل نقطة إدارية **تُعلن صلاحيتها** `@RequirePermission(...)`؛ نقطة محروسة بلا إعلان تفشل مغلقةً (403) وتفشل اختبار الميتاداتا في doc 18.
- كل رد يمرّ بغلاف موحّد (`{ data }` / `{ data, meta }`).
- كل DTO/كيان مُزيَّن بالكامل لـ `class-validator` و`@nestjs/swagger`.
- Markdown يُخزَّن ويُرجَع كسلسلة **غير مُفسَّرة (opaque)** — التعقيم عند العرض مسؤولية الـ frontend (`D01-5`).

## الوسائط بالمرجع فقط (على هذا الأساس)

الكيانات تشير إلى وسائط بمُعرّف خام: `Article.coverImageId`, `*.ogImageId`, gallery `mediaAssetId`, `Testimonial.avatarId`, `SiteSettings.resumeAssetId`. **لا وحدة رفع ولا تحويل descriptor على `main`** — تُرجَع الـ ids كما هي. الرفع والـ descriptors عمل Feature 003 (`In Progress`، خارج الأساس).

## ملاحظة عن `health`

وحدة `health` بسيطة (liveness عبر `process.uptime()` وreadiness عبر `SELECT 1` الذي يفتح الاتصال الكسول فعليًّا). لقيمتها التعليمية المحدودة **لا تحصل على `README.md` مخصّص**؛ سلوكها موصوف هنا وفي [الوثيقة 23](../../../eslammuatamed-docs/docs/23-deployment.md).

## المرجع الرسمي وحالة التوافق

- [NestJS Modules](https://docs.nestjs.com/modules) · [Controllers](https://docs.nestjs.com/controllers) · [Providers](https://docs.nestjs.com/providers) · [Validation](https://docs.nestjs.com/techniques/validation).

**حالة التوافق:** `Compatible`. تخطيط الوحدة (module/controller/service/dto/entities مع DI) هو تخطيط `NestJS` القياسي؛ وتقسيم admin/public داخل الوحدة قرار مشروع مُوثّق (`D08-2`) لا يخالف الإطار.
