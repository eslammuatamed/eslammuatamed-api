# `redirects` — تحويلات المسارات (slug redirects)

> يتبع الشكل القانوني في [`src/modules/README.md`](../README.md). هنا ما يخصّها فقط.

## المسؤولية

النموذج `SlugRedirect` (جدول `slug_redirects`) يُعبَّأ **تلقائيًّا** عند إعادة تسمية slug **منشور** لمقال/مشروع (`D04-6`)؛ غرضه إبقاء الروابط العامّة القديمة تعمل بعد تغيير الـ slug. لا CRUD إداري. السطح العام الوحيد: `GET /api/v1/redirects/resolve?locale&path` يترجم مسار موقع إلى وجهته الحالية (`D10-7`). كيان مسودّة/غير منشور لا يُنشئ أيّ تحويل إطلاقًا (البوّابة: كان منشورًا **ويبقى** منشورًا؛ انقلاب حالة النشر أو slug جديد بلا سابق لا يُنشئ تحويلًا).

## خريطة الملفّات

| الملف | الدور |
|---|---|
| `redirects.controller.ts` | `GET /api/v1/redirects/resolve?locale&path` عام (`@Public`) — `Cache-Control: no-store` |
| `redirect.service.ts` | `resolve()` + `buildRedirectOps()` (مُصدَّرة للمقالات/المشاريع) |
| `dto/*` · `entities/*` | استعلام `?locale&path` + ردّ `{ toPath }` |

## خريطة الاتصال

- **يعتمد على:** `PrismaService`، `LocalesService`.
- **يُصدِّر:** `RedirectService` — `ArticlesModule`/`ProjectsModule` تستدعي `buildRedirectOps` داخل `update()` (`T7`). لا دورة: `redirects` لا يستورد أيًّا منهما.

## ما يميّز هذه الوحدة عن النموذج

- **قواعد المسار (`D10-7`):** المسار نسبيّ للقسم (الواجهة تُزيل بادئة `/ar`). `‎/blog/{slug}‎` → `article`، `‎/projects/{slug}‎` → `project`؛ `toPath = /{section}/{toSlug}`. قسم مجهول أو لا سجلّ ⇒ `null` ⇒ `404` بصيغة problem+json (RFC 7807).
- **قفزة واحدة فقط:** بحث واحد على المفتاح الفريد `@@unique([locale, entityType, fromSlug])`؛ لا مشي عبر السلسلة.
- **`no-store` (تجاوز لسياسة §5):** التحويلات بيانات وقت-تشغيل؛ تخزين إخفاق مؤقّت يُخفي تحويلًا أُنشئ للتوّ (`D10-7`/`D04-6`).
- **`buildRedirectOps` لا يُنفِّذ:** يُرجِع 3 عمليّات مُقيّدة كلّها بـ `{ locale, entityType }` (طيّ السلاسل عبر `updateMany` → مسح المصدر القديم عبر `deleteMany` → **`upsert`** لصفّ `fromSlug→toSlug` على المفتاح الفريد) ليدفعها المُستدعي في `$transaction` الخاصّ به، فتُلتزَم ذرّيًّا مع إعادة التسمية. الـ `upsert` (لا `create`) يتفادى `P2002` حين يُعاد استخدام slug مُحرَّر فيُجهِض عمليّة إعادة التسمية كلّها.
- **بلا وحدة CRUD إدارية** (قرار المالك): التعبئة تلقائيّة فقط.

## العقود والثوابت

- تحقّق اللغة عبر `LocalesService.assertEnabled` (لغة غير مُفعّلة → 400، لا رجوع صامت).
- ثابت: slug منشور حيّ لا يكون أبدًا `fromSlug`؛ لا تحويل يشير لنفسه؛ الحلّ لا يدور.

## القيود المقبولة والمؤجَّل

- **لا CRUD يدويّ للتحويلات في F004** (قرار المالك): التعبئة تلقائيّة فقط عبر `buildRedirectOps`؛ لا وحدة `‎/admin/redirects‎`.
- الحلّ قفزة واحدة فقط؛ لا مشي عبر السلسلة — السلاسل تُطوى وقت الإنشاء لا وقت الحلّ.

## الاختبارات

`redirect.service.spec.ts` (Prisma مُموَّه) + `test/redirects.e2e-spec.ts`.

## المرجع الرسمي وحالة التوافق

- [Prisma — compound unique + transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions).

**حالة التوافق:** `Compatible`. **لا انحراف.**
