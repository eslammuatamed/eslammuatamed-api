# `experiences` — الخبرات (الخطّ الزمني المهني)

> يتبع الشكل القانوني في [`src/modules/README.md`](../README.md). هنا ما يخصّها فقط.

## المسؤولية

مدخلات الخبرة المهنية (دور، شركة، موقع، أثر) مع ترجمة لكل لغة، ونوع توظيف (`EmploymentType`: `FULL_TIME`/`PART_TIME`/`CONTRACT`/`FREELANCE`)، وتواريخ بداية/نهاية وعَلَم «حاليّ».

## خريطة الملفّات

| الملف | الدور |
|---|---|
| `experiences.controller.ts` · `experiences.admin.controller.ts` | قراءة عامّة (قائمة) + CRUD محروس |
| `experiences.service.ts` | المنطق + الترتيب الزمني + تحقّق نوع التوظيف |
| `dto/*` · `entities/*` | مدخلات/مخرجات |

## خريطة الاتصال

- **يعتمد على:** `PrismaService`، `LocalesService`.

## ما يميّز هذه الوحدة عن النموذج

- **قائمة بلا ترقيم**، مرتّبة بـ `startDate` تنازليًّا ثم `order` (`compareExperiences`).
- **`impact`** حقل Markdown (قائمة إنجازات) يُخزَّن opaque.
- **تحقّق `EmploymentType`** صريح (`assertEmploymentType`) → 422 لقيمة غير صالحة.
- **`endDate` ثلاثيّ الحالة** في التحديث: `undefined` = لا تغيير، `null` = مسح، قيمة = تعيين.

## العقود والثوابت

- تحقّق لغة لكل ترجمة؛ الكتابة داخل `$transaction`.

## الاختبارات

`experiences.service.spec.ts` + `test/experiences.e2e-spec.ts`.

## المرجع الرسمي وحالة التوافق

- [Prisma enums](https://www.prisma.io/docs/orm/prisma-schema/data-model/models#defining-enums) · [class-validator `@IsEnum`](https://github.com/typestack/class-validator#validation-decorators).

**حالة التوافق:** `Compatible`. النمط مطابق للنموذج القانوني؛ الـ enum ككود (لا جدول) لأنه مقترن بالكود (`D09-5`). **لا انحراف.**
