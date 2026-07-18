# `skills` — سجلّ المهارات

> يتبع الشكل القانوني في [`src/modules/README.md`](../README.md). هنا ما يخصّها فقط.

## المسؤولية

سجلّ المهارات مجمّعًا بـ `SkillGroup` (`LANGUAGE`/`FRAMEWORK`/`TOOLING`/`PRACTICE`)، بترجمة تسمية لكل لغة ولون علامة اختياري. يغذّي أيضًا تقنيات المشاريع (`ProjectTechnology`).

## خريطة الملفّات

| الملف | الدور |
|---|---|
| `skills.controller.ts` · `skills.admin.controller.ts` | قراءة عامّة (قائمة) + CRUD محروس |
| `skills.service.ts` | المنطق + الترتيب حسب المجموعة ثم `order` |
| `dto/*` · `entities/*` | مدخلات/مخرجات |

## خريطة الاتصال

- **يعتمد على:** `PrismaService`، `LocalesService`.
- **مُشار إليه من:** `projects` عبر جدول `project_technologies` (لا استيراد خدمة).

## ما يميّز هذه الوحدة عن النموذج

- **الترتيب حسب ترتيب الـ enum ثم `order`** (`compareSkills` يستخدم `Object.values(SkillGroup).indexOf`).
- **الحذف المحميّ:** مهارة مرتبطة بمشروع يُرفَض حذفها — `P2003`/`P2014` → 409 صريح («still linked to a project»).
- **قائمة بلا ترقيم.**

## العقود والثوابت

- تحقّق لغة لكل ترجمة؛ الكتابة داخل `$transaction`.

## الاختبارات

`skills.service.spec.ts` + `test/skills.e2e-spec.ts`.

## أخطاء شائعة

- حذف مهارة مستخدَمة في مشروع دون فكّ الربط أولًا.

## المرجع الرسمي وحالة التوافق

- [Prisma referential actions](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/referential-actions) · [Prisma enums](https://www.prisma.io/docs/orm/prisma-schema/data-model/models#defining-enums).

**حالة التوافق:** `Compatible`. **لا انحراف.**
