# `redirects` — تحويلات المسارات (slug redirects)

> يتبع الشكل القانوني في [`src/modules/README.md`](../README.md). هنا ما يخصّها فقط.

## المسؤولية

جدول `slug_redirects` يُعبَّأ **تلقائيًّا** عند إعادة تسمية slug **منشور** لمقال/مشروع (`D04-6`)؛ لا CRUD إداري. السطح العام الوحيد: `GET /redirects/resolve` يترجم مسار موقع إلى وجهته الحالية (`D10-7`).

## خريطة الملفّات

| الملف | الدور |
|---|---|
| `redirects.controller.ts` | `GET /redirects/resolve` عام (`@Public`) — `Cache-Control: no-store` |
| `redirect.service.ts` | `resolve()` + `buildRedirectOps()` (مُصدَّرة للمقالات/المشاريع) |
| `dto/*` · `entities/*` | استعلام `?locale&path` + ردّ `{ toPath }` |

## خريطة الاتصال

- **يعتمد على:** `PrismaService`، `LocalesService`.
- **يُصدِّر:** `RedirectService` — `ArticlesModule`/`ProjectsModule` تستدعي `buildRedirectOps` داخل `update()` (`T7`). لا دورة: `redirects` لا يستورد أيًّا منهما.

## ما يميّز هذه الوحدة عن النموذج

- **قواعد المسار (`D10-7`):** المسار نسبيّ للقسم (الواجهة تُزيل بادئة `/ar`). `‎/blog/{slug}‎` → `article`، `‎/projects/{slug}‎` → `project`؛ `toPath = /{section}/{toSlug}`. قسم مجهول أو لا سجلّ ⇒ `null` ⇒ `404`.
- **قفزة واحدة فقط:** بحث واحد على المفتاح الفريد `@@unique([locale, entityType, fromSlug])`؛ لا مشي عبر السلسلة.
- **`no-store` (تجاوز لسياسة §5):** التحويلات بيانات وقت-تشغيل؛ تخزين إخفاق مؤقّت يُخفي تحويلًا أُنشئ للتوّ (`D10-7`/`D04-6`).
- **`buildRedirectOps` لا يُنفِّذ:** يُرجِع 3 عمليّات (`updateMany` طيّ السلسلة → `deleteMany` مصدر قديم → `create`) ليدفعها المُستدعي في `$transaction` الخاصّ به، فتُلتزَم ذرّيًّا مع إعادة التسمية.
- **بلا وحدة CRUD إدارية** (قرار المالك): التعبئة تلقائيّة فقط.

## العقود والثوابت

- تحقّق اللغة عبر `LocalesService.assertEnabled` (لغة غير مُفعّلة → 400، لا رجوع صامت).
- ثابت: slug منشور حيّ لا يكون أبدًا `fromSlug`؛ لا تحويل يشير لنفسه؛ الحلّ لا يدور.

## الاختبارات

`redirect.service.spec.ts` (Prisma مُموَّه) + `test/redirects.e2e-spec.ts`.

## المرجع الرسمي وحالة التوافق

- [Prisma — compound unique + transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions).

**حالة التوافق:** `Compatible`. **لا انحراف.**
