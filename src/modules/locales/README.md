# `locales` — سجلّ اللغات المُفعّلة

> يتبع الشكل القانوني في [`src/modules/README.md`](../README.md). وحدة صغيرة لكنها محوريّة: خدمتها هي **حارس اللغة** المستخدَم في كل وحدات المحتوى.

## المسؤولية

جدول مرجعي للّغات المدعومة (`en` LTR، `ar` RTL). إضافة لغة = `INSERT` (`D09-5`). توفّر: قائمة اللغات المُفعّلة للعرض، والتحقّق من `?locale=` لكل قراءة عامّة.

## خريطة الملفّات

| الملف | الدور |
|---|---|
| `locales.controller.ts` | قراءة عامّة: `GET /locales` (اللغات المُفعّلة، مرتّبة) |
| `locales.service.ts` | `listEnabled()` + `assertEnabled(code)` — الحارس |
| `locales.module.ts` | يُصدِّر `LocalesService` (تحتاجه كل وحدة محتوى) |
| `entities/locale.entity.ts` | شكل اللغة العام (`code`, `name`, `nativeName`, `dir`) |

## خريطة الاتصال

- **وارد:** عشر وحدات تستورد `LocalesModule` — وحدات المحتوى (`articles`, `projects`, `settings`, `taxonomy`, `skills`, `experiences`, `testimonials`) وكذلك `media` و`seo` و`redirects` — وتستدعي `assertEnabled(locale)` قبل أيّ قراءة/كتابة مُترجَمة.
- **يعتمد على:** `PrismaService` فقط.

## التدفّق: الحارس `assertEnabled`

```ts
const locale = await this.prisma.locale.findUnique({ where: { code } });
if (!locale || !locale.isEnabled) throw new BadRequestException(`Unknown or disabled locale '${code}'.`);
```

لغة مجهولة أو مُعطَّلة → **400**، لا رجوع صامت لأخرى. هذا هو مصدر الإنفاذ لقاعدة «لا fallback عبر اللغات» على مستوى كامل المنصّة.

## العقود والثوابت

- `dir` (`ltr`/`rtl`) بيانات لا كود — يقود معالجة RTL في الـ frontend.
- قائمة العرض تُرجِع المُفعّلة فقط، مرتّبة بـ `order`.

## الاختبارات

`locales.service.spec.ts` (قبول المُفعّلة، رفض المجهولة/المُعطَّلة). e2e ضمنيًّا في كل قراءة عامّة مُترجَمة.

## المرجع الرسمي وحالة التوافق

- [Prisma models](https://www.prisma.io/docs/orm/prisma-schema/data-model/models) · [NestJS Providers (exported service)](https://docs.nestjs.com/modules#shared-modules).

**حالة التوافق:** `Compatible`. جدول مرجعي + خدمة مُصدَّرة مُشتركة نمط قياسي. اللغة كبيانات (لا enum) قرار مُوثّق (`D09-5`). **لا انحراف.**
