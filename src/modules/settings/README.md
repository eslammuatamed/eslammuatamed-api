# `settings` — إعدادات الموقع (singleton)

> يتبع الشكل القانوني في [`src/modules/README.md`](../README.md). هنا ما يخصّ `settings` فقط.

## المسؤولية

صفّ **مفرد (singleton)** لإعدادات الموقع: روابط الملف الشخصي، حالة التوفّر، بداية المسيرة المهنية، حقول الرأس العامّة (تحقّق محرّكات البحث، التحليلات، metas مخصّصة — `FR-DSH-052`)، وحقول مُترجَمة (اسم الموقع، الشعار، metas افتراضية).

## خريطة الملفّات

| الملف | الدور |
|---|---|
| `settings.controller.ts` | قراءة عامّة مُحلّلة: `GET /settings?locale=` |
| `settings.admin.controller.ts` | قراءة كاملة + تحديث جزئي محروس |
| `settings.service.ts` | تحميل الـ singleton، التحليل، التحديث الجزئي، تحقّق الحقول |
| `dto/update-settings.dto.ts` · `entities/site-settings.entities.ts` | مدخلات/مخرجات |

## خريطة الاتصال

- **يعتمد على:** `PrismaService`، `LocalesService`.

## ما يميّز هذه الوحدة عن النموذج

- **Singleton عبر `findFirst`** (`loadSingletonOrThrow`): لا يوجد id في المسار؛ صفّ واحد يُنشأ في الـ seed. غياب الصفّ → 404 «لم تُهيّأ».
- **قراءة عامّة مقابل إدارية:** العامّة تُسطّح الترجمة للّغة المطلوبة وتُخفي ما يجب إخفاؤه؛ الإدارية تُرجِع كل شيء + خريطة الترجمة.
- **بوابة التحليلات (`D20-5`):** وسم تحليلات مُعطَّل (`analyticsEnabled=false` أو ناقص المعرّف) **لا يُعلَن للعميل أبدًا** في القراءة العامّة (يُرجِع `analytics: null`).
- **أعمدة JSON:** `profileLinks` و`customMetas` تُعاد بناؤها كقيم صريحة (JSON لا يحمل `undefined`، فيُحذف مفتاح `icon` عند غيابه).
- **تحقّق بداية المسيرة:** `careerStartYear`/`careerStartMonth` إمّا كلاهما حاضر أو كلاهما غائب، ضمن نطاقات (`validateCareerStart`).
- **الوسائط بالمرجع:** `resumeAssetId` يُرجَع خامًا في القراءة الإدارية (لا descriptor على هذا الأساس؛ وصف الـ résumé PDF عمل Feature 003).

## العقود والثوابت

- التحديث جزئي: الحقول غير الممرَّرة تبقى دون تغيير؛ صفّ الإعداد وترجماته يُحدَّثان في `$transaction` واحد.
- تحقّق لغة لكل ترجمة مُمرَّرة.

## الاختبارات

`settings.service.spec.ts` + `test/settings.e2e-spec.ts` (تُثبت التحليل العام، بوابة التحليلات، التحديث الجزئي).

## أخطاء شائعة

- توقّع إنشاء الـ singleton عبر الـ API — يُنشأ في الـ seed فقط.
- إعلان وسم تحليلات مُعطَّل في السطح العام.

## المرجع الرسمي وحالة التوافق

- [Prisma Json fields](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields) · [class-validator](https://github.com/typestack/class-validator).

**حالة التوافق:** `Compatible`. نمط الـ singleton + التحديث الجزئي داخل `$transaction` + التعامل الآمن مع أعمدة JSON كلها أنماط `Prisma`/`NestJS` قياسية. **لا انحراف.**
