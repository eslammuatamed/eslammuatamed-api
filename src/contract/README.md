# `src/contract` — تصدير عقد `OpenAPI`

## المسؤولية

توليد مستند `OpenAPI` (`openapi.json`) الذي هو **العقد الرسمي الوحيد** بين `api` و`web` (`principle 3`، [الوثيقة 00 §3](../../../eslammuatamed-docs/docs/00-engineering-principles.md)). مصدر واحد لإعداد المستند يخدم `/docs` UI وقت التشغيل وسكربت التصدير معًا.

## خريطة الملفّات

| الملف | الدور |
|---|---|
| `openapi.config.ts` | `buildOpenApiConfig()` — عنوان/وصف/إصدار المستند، مخطّط أمان `access-token` (bearer)، والـ tags |
| `export-openapi.ts` | سكربت مستقلّ: يُقلِع رسم `Nest` بلا logger، يبني المستند، يكتب `openapi.json`، يُغلِق |

## خريطة الاتصال

- **وارد:** `main.ts` يستدعي `buildOpenApiConfig()` لـ `/docs` UI؛ سكربت `contract:export` يستدعيه للتصدير.
- **صادر:** `@nestjs/swagger` (`SwaggerModule`, `DocumentBuilder`) + `AppModule`.

## تدفّق التشغيل (`npm run contract:export`)

```
NestFactory.create(AppModule, { logger: false, abortOnError: false })
   → app.setGlobalPrefix('api'); app.enableVersioning({ URI, v1 })   // مطابق لـ main.ts
   → SwaggerModule.createDocument(app, buildOpenApiConfig())
   → writeFileSync('openapi.json', JSON.stringify(document))
   → app.close()
```

نقطتان دقيقتان في الكود:
- `abortOnError: false` — مع إطفاء الـ logger، مسار الإجهاض الافتراضي لـ `Nest` هو `process.exit(1)` صامت يتجاوز الـ `catch`؛ فالرمي يُبقي أخطاء الإقلاع قابلة للطباعة.
- البادئة والإصدار يُطبَّقان **بنفس شكل `main.ts`** حتى تطابق المسارات المُوثّقة مسارات وقت التشغيل.

## الثابت الحرج (invariant)

**يجب أن يعمل `contract:export` دون قاعدة بيانات.** هذا ممكن فقط لأن اتصال `Prisma` كسول ([`src/prisma/README.md`](../prisma/README.md)). هذا الثابت هو `constitution rule 4` ويُختبَر في مسار `verify` بالـ CI.

## تدفّق تغيير العقد

انظر [الوثيقة 16 §3](../../../eslammuatamed-docs/docs/16-development-conventions.md): عدِّل decorators في الـ controllers/DTOs ← `contract:export` ← يتبنّى `web` الملف عبر commit ذرّي.

## الملكية والمراجعة

`openapi.json` المُصدَّر والملتزَم هنا هو مصدر الحقيقة الوحيد لعقد الـ API ↔ الويب. مصدر تغييره هو
سلوك التطبيق وdecorators وDTOs؛ لا يُحرَّر ناتج JSON يدويًّا. كما أنّه يصف سلوك API فقط، وليس مكانًا
لـ fixtures أو mock data أو أمثلة اختبار يملكها مستهلك frontend. يزامن مستهلكو الواجهة هذا الناتج
كما هو ثم يولّدون أنواعهم منه.

في مراجعة تغيير العقد: راجع التغيير في المصدر أولًا، شغّل `npm run contract:export`، والتزم بالناتج
المتولد مع التغيير المقصود. تتحقق CI أيضًا من أن `openapi.json` الملتزم نقطة ثابتة للتصدير؛ فرق واسع
غير متوقع عند التبنّي يجب أن يوقف المزامنة لدى المستهلك للتحقيق في provenance، لا أن يدفعه لتعديل
الأثر أو انتقاء أجزاء منه.

## المرجع الرسمي وحالة التوافق

- [NestJS OpenAPI (Swagger)](https://docs.nestjs.com/openapi/introduction) · [DocumentBuilder](https://docs.nestjs.com/openapi/introduction#bootstrap) · [OpenAPI Specification](https://spec.openapis.org/).

**حالة التوافق:** `Compatible`. استخدام `SwaggerModule.createDocument` + `DocumentBuilder` هو النمط الرسمي؛ وكتابة المستند إلى ملفّ مُلتزَم في المستودع (يرفعه الـ CI أثرًا لسير العمل) امتداد مشروع (project convention) لا يخالف الإطار. **وليس أثرَ إصدار (release artifact):** إرفاقه بإصدار عمل مؤجَّل، لا واقع قائم.
