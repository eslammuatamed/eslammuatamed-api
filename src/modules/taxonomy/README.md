# `taxonomy` — التصنيفات والوسوم (categories + tags)

> يتبع الشكل القانوني في [`src/modules/README.md`](../README.md). هنا ما يخصّ `taxonomy` فقط.

## المسؤولية

كيانان يتغيّران معًا فيسكنان وحدة واحدة (`D08-2`): `categories` (لمقال واحد لكلٍّ) و`tags` (many-to-many مع المقالات). كلاهما مُترجَم بـ slug فريد لكل لغة.

## خريطة الملفّات

| الملف                                                         | الدور                               |
| ------------------------------------------------------------- | ----------------------------------- |
| `categories.controller.ts` · `categories.admin.controller.ts` | قراءة عامّة + CRUD محروس للتصنيفات  |
| `tags.controller.ts` · `tags.admin.controller.ts`             | قراءة عامّة + CRUD محروس للوسوم     |
| `categories.service.ts` · `tags.service.ts`                   | منطق كلٍّ (متطابق البنية تقريبًا)   |
| `taxonomy.module.ts`                                          | يجمع الأربعة controllers + الخدمتين |
| `dto/*` · `entities/*`                                        | مدخلات/مخرجات لكلٍّ                 |

## خريطة الاتصال

- **يعتمد على:** `PrismaService`، `LocalesService`.
- **مُشار إليه من:** `articles` (تصنيف/وسوم المقال) — عبر الجداول لا عبر استيراد الخدمة.

## ما يميّز هذه الوحدة عن النموذج

- **فصل العام عن الإدارة:** `GET /categories` و`GET /tags` يبقيان عامّين ومُحلّين حسب اللغة داخل مصفوفة `{ data: [...] }`. أمّا قائمتا الإدارة فتستخدمان ترقيمًا قانونيًا (`page`/`perPage` و`{ data, meta }`)؛ التكامل الأمامي مع عقد الإدارة مؤجّل إلى ما بعد إصدار الخلفية.
- **الإسقاط عند غياب الترجمة:** القائمة العامّة تُسقِط أي عنصر بلا ترجمة في اللغة المطلوبة (`resolvePublic` يُرجِع `null` ثم يُصفّى).
- **حذف صلب محميّ (`D09-3`):** حذف تصنيف/وسم مُستخدَم محميّ بـ `RESTRICT`/`CASCADE` على مستوى المخطّط؛ تصنيف مُستخدَم من مقالات يُرفَض حذفه (`P2003` → 409). أعِد التصنيف أولًا.

## العقود والثوابت

- slug فريد لكل لغة لكل كيان.
- الترجمات تُكتب بـ `upsert` داخل `$transaction`.

## الاختبارات

`categories.service.spec.ts` و`tags.service.spec.ts`، مع `test/taxonomy-pagination.e2e-spec.ts` لعقدي الإدارة والعام. e2e ذات صلة: `test/articles.e2e-spec.ts` (تصفية بالتصنيف/الوسم).

## أخطاء شائعة

- خلط عقد الإدارة المرقّم بعقد القراءة العام غير المرقّم.
- محاولة حذف تصنيف مُستخدَم دون إعادة تصنيف مقالاته.

## المرجع الرسمي وحالة التوافق

- [Prisma referential actions](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/referential-actions) · [NestJS Modules](https://docs.nestjs.com/modules).

**حالة التوافق:** `Compatible`. جمع كيانين مترابطين في وحدة واحدة قرار مشروع مُوثّق (`D08-2`)؛ والحذف المحميّ بـ `RESTRICT` نمط `Prisma` قياسي. **لا انحراف.**
