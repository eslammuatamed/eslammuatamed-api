# `src/modules` — الشكل القانوني للوحدة (module archetype)

هذا الملف يصف **النمط المشترك** لكل وحدات المجال، حتى لا تكرّره ملفات `README.md` لكل وحدة. اقرأه أولًا، ثم اقرأ الوحدة المعنيّة لما يخصّها فقط.

## الوحدات

مرتَّبة أبجديًّا، كما تظهر في `src/modules/`. ولكلٍّ منها ملفّ `README.md` خاصّ عدا `health`
(انظر الملاحظة في آخر هذا الملف):

`access-control` · `articles` · `auth` · `contact` · `experiences` · `health` · `locales` ·
`mail` · `media` · `preview` · `projects` · `redirects` · `seo` (`FR-DSH-051`، `D10-24`) ·
`settings` · `skills` · `taxonomy` · `testimonials` · `users`.

> **لماذا لا تجد هنا «منشورة» و«بانتظار الإصدار»؟** كانت هذه القائمة مقسَّمة سابقًا حسب حالة
> النشر. والحالة تتغيّر بينما النصّ لا يتغيّر معها، فيتحوّل الملف بصمت إلى مصدر خاطئ يثق به
> القارئ. الأسوأ أنّ التقسيم نفسه أضاع وحدة: `mail` لم تكن مذكورة في أيٍّ من القسمين لأنّها لم
> تنتمِ بوضوح إلى أحدهما، فاختفت من الفهرس رغم وجود `README.md` لها يُحيل إلى هذا الملف.
>
> حالة الإصدار والنشر يملكها مستودع الوثائق الحاكمة وسجلّ الإصدارات، لا ملفّ ملاصق للكود.
> اسأل المصدر عند الحاجة؛ ولا تُضِف الحالة هنا مهما بدت مفيدة لحظة الكتابة.

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

الكيانات تشير إلى وسائط بمُعرّف خام: `Article.coverImageId`, `*.ogImageId`, gallery `mediaAssetId`, `Testimonial.avatarId`, `SiteSettings.resumeAssetId`. وحدة `media` تُدير الرفع والمعالجة والتخزين وحلّ الـ descriptors: القراءات العامّة تُبقي الـ `*Id` الخام وتُضيف بجانبها descriptor مُحلّلًا (URL على أصل الوسائط + أبعاد + `blurhash` + نصّ بديل). التفاصيل في [`media/README.md`](media/README.md).

## ملاحظة عن `health`

وحدة `health` بسيطة (liveness عبر `process.uptime()` وreadiness عبر `SELECT 1` الذي يفتح الاتصال الكسول فعليًّا). لقيمتها التعليمية المحدودة **لا تحصل على `README.md` مخصّص**؛ سلوكها موصوف هنا وفي [الوثيقة 23](../../../eslammuatamed-docs/docs/23-deployment.md).

**الفرق بين النقطتين ليس تفصيلًا شكليًّا — وهو ما أوقف الإنتاج مرّة.**

| النقطة | ما تفعله | ما تُثبته | ما **لا** تُثبته |
| --- | --- | --- | --- |
| `/api/v1/health` (`liveness`) | تقرأ `process.uptime()` | العملية حيّة وتستمع على المنفذ | **لا شيء** عن قاعدة البيانات — لا تلمسها إطلاقًا |
| `/api/v1/health/ready` (`readiness`) | تنفّذ `SELECT 1` عبر `PrismaService` | الاتصال بقاعدة البيانات قائم ويعمل | لا تُثبت أنّ مسارات الاستعلام الحقيقية في التطبيق تخدم بيانات |

**لماذا لا يجوز أن يعتمد نشر الإنتاج على `liveness` وحدها.** تطبيقٌ لا يستطيع الوصول إلى قاعدة
البيانات إطلاقًا **يجتاز** فحص الحياة، لأنّ العملية تستمع. وبتاريخ `2026-08-14` قُبِل إصدارٌ
كانت كلّ نقاطه المعتمدة على قاعدة البيانات تُرجع `500` لأنّ بوابة التحويل كانت تستدعي
`/api/v1/health` فقط. والأسوأ أنّ **التراجع التلقائي معلَّق على البوابة ذاتها**، فبوابةٌ تمرّ
زورًا تُبطِل التراجع في اللحظة التي يُحتاج فيها بالضبط.

الفحص هنا **غير مُميِّز** بالمعنى الدقيق: نتيجته كانت ستبقى `200` حتى لو حُذفت طبقة البيانات
كلّها — وهذا هو تعريف الاختبار الذي لا يقيس ما يدّعي قياسه.

**البوابة الحالية** تشترط `liveness` **و**`readiness` **و**نقطتَي دخان معتمدتين على قاعدة
البيانات (`/api/v1/settings/site` و`/api/v1/projects`)، ويُتحقَّق من **هدف التراجع بالفحوص
نفسها** (`D23-23`، الوثيقة 18 §4b). النقطتان الأخيرتان ضروريتان لأنّ إثبات وجود اتصال ليس
إثباتًا أنّ الـ `ORM` يخدم بيانات عبر مسارات الاستعلام الفعلية.

## المرجع الرسمي وحالة التوافق

- [NestJS Modules](https://docs.nestjs.com/modules) · [Controllers](https://docs.nestjs.com/controllers) · [Providers](https://docs.nestjs.com/providers) · [Validation](https://docs.nestjs.com/techniques/validation).

**حالة التوافق:** `Compatible`. تخطيط الوحدة (module/controller/service/dto/entities مع DI) هو تخطيط `NestJS` القياسي؛ وتقسيم admin/public داخل الوحدة قرار مشروع مُوثّق (`D08-2`) لا يخالف الإطار.
