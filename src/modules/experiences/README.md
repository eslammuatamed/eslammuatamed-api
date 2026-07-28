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

## التقنيات عبر سجلّ المهارات (الميزة 008)

`FR-PUB-021` يطلب «التقنيات» على كل خبرة. المصدر الوحيد المعتمَد هو **سجلّ المهارات**
(`Skill`) عبر جدول وصل `ExperienceTechnology` — بنفس نمط `ProjectTechnology` تمامًا (`D02-9`,
`D09-17`).

- **مفتاح أساسي مركّب** `(experienceId, skillId)` — التكرار مستحيل بنيويًّا؛ وفهرس على `skillId`.
- **بدون عمود ترتيب:** الترتيب يُشتقّ من `Skill.order`، فيبقى متّسقًا بين المشاريع والخبرات.
  يُضاف عمود ترتيب لاحقًا فقط إذا أثبت متطلّب عرض حقيقي أنّ `Skill.order` غير كافٍ.
- **لا قوائم تقنيات نصّية حرّة:** لا يُقبل أي نصّ حرّ؛ المعرّفات فقط.
- **الاستبدال داخل معاملة (transaction):** `deleteMany` ثم `createMany` ضمن الـ `$transaction`
  نفسه، فلا يمكن أن يبقى سجلّ بلا روابط بعد فشل جزئي.
- **الرفض المبكر:** معرّف مهارة غير موجود أو مكرّر داخل الطلب → `422` يُسمّي المشكلة، بدل خطأ
  مفتاح أجنبي غامض أو حذف صامت للتكرار.
- **الحذف:** `Cascade` من الخبرة (حذف الخبرة يزيل روابطها)، و`Restrict` من المهارة (لا يمكن
  حذف مهارة مرتبطة بخبرة).
- **الاستجابة العامّة** تُعيد `{ id, label }` باللغة المطلوبة فقط — **بلا رجوع إلى لغة أخرى**؛
  مهارة بلا ترجمة في تلك اللغة تُحذف من القائمة.
