# `testimonials` — الشهادات (اقتباسات)

> يتبع الشكل القانوني في [`src/modules/README.md`](../README.md). هنا ما يخصّها فقط.

## المسؤولية

اقتباسات مع اسم/دور صاحبها (مُترجَمة)، صورة رمزية اختيارية، ترتيب عرض، وعَلَم ظهور (`isVisible`).

## خريطة الملفّات

| الملف | الدور |
|---|---|
| `testimonials.controller.ts` · `testimonials.admin.controller.ts` | قراءة عامّة (قائمة) + CRUD محروس |
| `testimonials.service.ts` | المنطق + الترتيب + بوابة الظهور |
| `dto/*` · `entities/*` | مدخلات/مخرجات |

## خريطة الاتصال

- **يعتمد على:** `PrismaService`، `LocalesService`، و`MediaDescriptorResolver` (من `MediaModule` — واصف `avatar` في القراءة العامّة).

## ما يميّز هذه الوحدة عن النموذج

- **بوابة `isVisible`:** القائمة العامّة تُرجِع المرئيّة فقط (`where: { isVisible: true }`)؛ القائمة الإدارية تُرجِع الكلّ.
- **الترتيب بـ `order` تصاعديًّا.**
- **الوسائط:** `avatarId` يُرجَع خامًا **ويُضاف بجانبه** `avatar` — descriptor مُحلَّل (`PublicMediaImageDescriptor`، قابل لـ `null`) في القراءة العامّة. المُعرّف الخام لا يختفي (القسم ٦.٥ من الدليل).
- **قائمة بلا ترقيم.**

## العقود والثوابت

- تحقّق لغة لكل ترجمة؛ الكتابة داخل `$transaction`.

## الاختبارات

`testimonials.service.spec.ts` + `test/testimonials.e2e-spec.ts` (تُثبت بوابة `isVisible`).

## المرجع الرسمي وحالة التوافق

- [Prisma queries — filtering](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting).

**حالة التوافق:** `Compatible`. **لا انحراف.**
