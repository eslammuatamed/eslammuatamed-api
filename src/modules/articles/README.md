# `articles` — المدوّنة (أغنى وحدة محتوى)

> اقرأ [`src/modules/README.md`](../README.md) أولًا. هذه الوحدة هي **النموذج المرجعي** لأنها تمارس كل النظم الصعبة: الترجمة، الجدولة، البحث النصّي، علاقات التصنيف، والمقالات المرتبطة.

## المسؤولية

CRUD المقالات مع ترجمات لكل لغة، حالات محتوى (`DRAFT`/`SCHEDULED`/`PUBLISHED`/`ARCHIVED`)، نشر مجدول، بحث نصّي كامل (FTS)، ومقالات مرتبطة. لكل مقال تصنيف (`category`) واحد ووسوم (`tags`) متعدّدة.

## خريطة الملفّات

| الملف | الدور |
|---|---|
| `articles.controller.ts` | قراءات عامّة: `GET /articles`, `/articles/:slug`, `/articles/:slug/related` |
| `articles.admin.controller.ts` | CRUD محروس تحت `/admin/articles` (كل نقطة تُعلن `articles.*`) |
| `articles.service.ts` | كل المنطق: القوائم، البحث، التفاصيل، المرتبطة، الكتابة، ترقية المجدولة |
| `articles.scheduler.ts` | cron كل دقيقة يرقّي المقالات المستحقّة |
| `articles.module.ts` | يستورد `LocalesModule`؛ يسجّل الـ scheduler كـ provider |
| `dto/*` · `entities/*` | مدخلات (مع الاستعلامات) ومخرجات (public list/detail + admin بخريطة ترجمة كاملة) |

## خريطة الاتصال

- **وارد:** — (لا وحدة أخرى تستورد `ArticlesService`).
- **يعتمد على:** `PrismaService`، `LocalesService` (تحقّق اللغة)، و`@nestjs/schedule` (يكتشف `@Cron` في الـ scheduler لأنه provider).

## التدفّقات

### قائمة عامّة — `GET /articles?locale=&category=&tag=&q=&page=&perPage=`
```
assertEnabled(locale)
  → q غير فارغ؟ → searchPublic (FTS)   :   → buildPublicWhere (قائمة مُفهرَسة عادية)
  → PUBLISHED فقط، مُصفّاة بالتصنيف/الوسم في نفس اللغة
  → ترتيب: publishAt desc (nulls last) ثم createdAt desc
  → resolveListItem(row, locale)  →  { data, meta }
```
المسودّات/المجدولة/المؤرشفة **لا تظهر أبدًا** في السطح العام (`FR-PUB-046`).

### البحث النصّي الكامل (FTS)
عند `q` غير فارغ، يمرّ عبر `$queryRaw` مُعامَل على عمود `search_vector` المولّد + فهرس `GIN` (`D09-6`):
- `regconfig` لكل لغة: `'english'` للإنجليزية، `'simple'` للعربية (نفس الإعداد الذي بُني به العمود).
- الترتيب بـ `ts_rank` ثم الحداثة؛ الاستعلام يُرجِع الـ ids فقط، ثم تُروى (hydrate) عبر نفس `include` العادي (فيبقى التحليل في مكان واحد) وتُعاد ترتيبها لتطابق الرتبة.
- **الأمان:** كل قيمة مُمرَّرة عبر `Prisma.sql` (مُعامَلة)، لا سَلسلة نصّية — محصّنة ضد حقن SQL.

### التفاصيل — `GET /articles/:slug`
البحث بالـ slug لكل لغة (`locale_slug`)؛ slug لمقال غير منشور يُعيد 404 تمامًا كـ slug مجهول (الإخفاء لا يُميَّز عن الغياب — `doc 19 A01`). التفاصيل تحمل `slugs` (خريطة slug لكل لغة) ليبدّل الـ frontend اللغة دون تخمين.

### المقالات المرتبطة — `GET /articles/:slug/related`
حتى 3 مقالات منشورة تشارك التصنيف و/أو الوسوم، مرتّبة: **نفس التصنيف أولًا**، ثم عدد الوسوم المشتركة، ثم حداثة النشر (`doc 04 §5`).

### النشر المجدول (`articles.scheduler.ts`)
```
@Cron(EVERY_MINUTE) → promoteScheduled(now):
  updateMany({ where: { status: SCHEDULED, publishAt: <= now }, data: { status: PUBLISHED } })
```
استعلام واحد idempotent (تشغيل مزدوج = لا عمل). `@Cron` يلفّ المعالج في try/catch تلقائيًّا فخطأ DB عابر يُسجَّل ويُعاد الدقيقة التالية بدل إسقاط العملية. صحيح لنسخة API واحدة (`D07-3`).

### الكتابة الإدارية
- الترجمات تُكتب بـ `upsert` لكل لغة داخل `$transaction`؛ زمن القراءة (`readingTimeMin`) يُحسَب عند الكتابة (~200 كلمة/دقيقة).
- الوسوم تُستبدَل كليًّا عند تمرير `tagIds` (`deleteMany` ثم `createMany`).
- قواعد `publishAt`: `SCHEDULED` تحتاج `publishAt` مستقبليًّا (ماضٍ/مفقود → 422)؛ `PUBLISHED` مباشر يختم `publishAt = now` إن غاب (ليبقى الترتيب مستقرًّا).

## العقود والثوابت

- السطح العام: `PUBLISHED` فقط، مُحلّل للّغة، بلا رجوع صامت عبر اللغات.
- slug فريد لكل لغة (`@@unique([locale, slug])`)؛ تصادم → `P2002` → 422.
- حذف تصنيف مُستخدَم محميّ بـ `RESTRICT` → 409.
- الوسائط: `coverImageId` و`ogImageId` تُرجَعان **خامَّين، ويُضاف بجانبهما** `coverImage` و`ogImage` — descriptor مُحلَّل (`PublicMediaImageDescriptor`، قابل لـ `null`) تبنيه `MediaDescriptorResolver` في القراءة العامّة. الحقلان الخامّان **لا يختفيان**؛ الوصف يُضاف إليهما ولا يحلّ محلّهما (القسم ٦.٥ من الدليل، و[`media/README.md`](../media/README.md)).

## الاختبارات وما تُثبته

`articles.service.spec.ts` (القوائم/التفاصيل/الكتابة/الترقية)، و e2e: `test/articles.e2e-spec.ts` + `test/articles-related.e2e-spec.ts` (تُثبت إخفاء المسودّات، ترتيب المرتبطة، مطابقة العقد).

## وصفات تعديل + نقاط تمديد آمنة + أخطاء شائعة

- **إضافة فلتر قائمة جديد:** أضِفه في `ArticleListQueryDto` + `buildPublicWhere` (لا تلمس مسار الـ FTS إلا إن كان الفلتر يخصّه).
- **تغيير عدد المرتبطة:** ثابت `slice(0, 3)` في `getPublicRelated`.
- **خطأ شائع:** إضافة رجوع للّغة الافتراضية عند غياب الترجمة — ممنوع (`D05-3`).
- **خطأ شائع:** بناء استعلام FTS بسَلسلة نصّية بدل `Prisma.sql` — ثغرة حقن.

## المرجع الرسمي وحالة التوافق

- [NestJS Task scheduling](https://docs.nestjs.com/techniques/task-scheduling) · [Prisma raw queries](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries) · [Prisma transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) · [PostgreSQL Full Text Search](https://www.postgresql.org/docs/16/textsearch.html).

**حالة التوافق:**
- **cron داخل العملية عبر `@nestjs/schedule`:** `Compatible` — النمط الرسمي (`@Cron(CronExpression...)` على provider). تحذير التوسّع الأفقي (قفل موزّع لأكثر من نسخة) موثّق (`D07-3`، الوثيقة 07 §5).
- **FTS عبر `$queryRaw` مُعامَل:** `Compatible` — `Prisma` يوصي بالاستعلام الخام المُعامَل لما لا يعبّر عنه Prisma Client (كأعمدة `tsvector`)؛ المعاملة تحصّن ضد الحقن.
- **الكتابات متعدّدة الجداول في `$transaction`:** `Compatible` — واجهة `$transaction([...])` الرسمية.

**لم يُرصَد انحراف غير مُفسَّر في هذه الوحدة.**
