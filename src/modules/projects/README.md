# `projects` — دراسات الحالة (case studies)

> يتبع الشكل القانوني في [`src/modules/README.md`](../README.md). هنا ما يخصّ `projects` فقط.

## المسؤولية

مشاريع/دراسات حالة مع ترجمات لكل لغة، معرض صور (gallery)، تقنيات مستخدَمة (روابط إلى `skills`)، وحقول دراسة حالة مُهيكلة (`overview`, `businessProblem`, `solution`, `role`, `architecture`, `challenges`, `features`, `lessonsLearned` — كلها Markdown).

## خريطة الملفّات

| الملف | الدور |
|---|---|
| `projects.controller.ts` | قراءات عامّة: `GET /projects`, `/projects/:slug` |
| `projects.admin.controller.ts` | CRUD محروس تحت `/admin/projects` |
| `projects.service.ts` | المنطق: القوائم، التفاصيل، الكتابة مع gallery/technologies |
| `dto/*` · `entities/*` | مدخلات/مخرجات (public list/detail + admin بخريطة كاملة) |

## خريطة الاتصال

- **يعتمد على:** `PrismaService`، `LocalesService`.
- **علاقات:** `ProjectTechnology` (many-to-many مع `Skill`)، `ProjectGalleryItem` (صور + تعليق مُترجَم).

## ما يميّز هذه الوحدة عن النموذج

- **البوابة العامّة `isPublished`** (لا حالة `ContentStatus` كالمقالات): القائمة والتفاصيل العامّة تُرجِع المنشور فقط؛ غير المنشور → 404.
- **الترتيب:** `featured` تنازليًّا ثم `order` تصاعديًّا.
- **الكتابة المركّبة:** `technologies` و`gallery` يُستبدَلان كليًّا عند تمريرهما (`deleteMany` ثم إعادة الإنشاء) داخل `$transaction`. تعليقات المعرض تُخزَّن كترجمات لكل عنصر.
- **تعيين خطأ محلّي:** `mapProjectWriteError` يحوّل `P2002` (تصادم slug/علاقة) إلى 422.
- **الوسائط بالمرجع:** عناصر المعرض تُرجِع `mediaAssetId` خامًا، و`ogImageId` خامًا (لا descriptor على هذا الأساس).

## العقود والثوابت

- slug فريد لكل لغة؛ تحقّق لغة لكل ترجمة **ولكل تعليق معرض**.
- تقنية تشير إلى `Skill` عبر `RESTRICT` (حذف skill مرتبطة يُمنَع من جهة `skills`).

## الاختبارات

`projects.service.spec.ts` + `test/projects.e2e-spec.ts` (تُثبت بوابة `isPublished`، المعرض، التقنيات، مطابقة العقد).

## أخطاء شائعة

- نسيان تحقّق لغة تعليقات المعرض (تُفحَص صراحةً في `assertLocales`).
- توقّع تحديثًا جزئيًّا للمعرض — التمرير يستبدله كليًّا.

## المرجع الرسمي وحالة التوافق

- [Prisma nested writes](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#nested-writes) · [Prisma transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions).

**حالة التوافق:** `Compatible`. الكتابات المتداخلة والاستبدال الكلّي للعلاقات داخل `$transaction` أنماط `Prisma` رسمية. **لا انحراف.**
