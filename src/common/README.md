# `src/common` — الآليات العرضية (cross-cutting mechanics)

## المسؤولية

كل الآليات المشتركة التي تعمل حول الطلب: الحرّاس، الفلاتر، الـ interceptors، الـ decorators، مساعدات الترقيم (pagination)، ونموذج الخطأ. القاعدة الحديدية: **`common/` يحوي آليات فقط، لا منطق عمل، ولا يستورد من `modules/` أبدًا** — اتجاه التبعية أحادي ([الوثيقة 08](../../../eslammuatamed-docs/docs/08-folder-structure.md)).

## خريطة الملفّات

| الملف | الدور |
|---|---|
| `guards/jwt-auth.guard.ts` | `JwtAuthGuard` العام (default-deny): يتحقّق من access token بـ `JwtService`، يضع `request.user` |
| `decorators/public.decorator.ts` | `@Public()` — يُعلن مسارًا عامًّا (يتخطّى الحارس) عبر metadata `IS_PUBLIC_KEY` |
| `auth/authenticated-user.ts` | نوع `AuthenticatedUser` (`{ id }`) — مُبقًى في `common/` كي لا يستورد الحارس من `modules/` |
| `filters/all-exceptions.filter.ts` | `AllExceptionsFilter` العام: كل استثناء → `RFC 7807 problem+json` |
| `http/problem-details.ts` | نوع `ProblemDetails` + `ProblemDetailsDto` (لـ Swagger) + `PROBLEM_TYPES` |
| `http/validation-problem.exception.ts` | `ValidationProblemException` + `flattenValidationErrors` (مسارات حقول مُنقَّطة) |
| `interceptors/response-envelope.interceptor.ts` | `ResponseEnvelopeInterceptor`: يغلّف كل رد 2xx في `{ data }` أو `{ data, meta }` |
| `pagination/page-meta.ts` | `PageMeta`, `buildPageMeta`, و`PaginatedResult<T>` (الحارس الذي يفكّه الـ interceptor إلى قائمة) |
| `dto/pagination-query.dto.ts` | `PaginationQueryDto` — ترقيم offset (page/perPage مع getters skip/take) |
| `dto/locale-query.dto.ts` | `LocaleQueryDto` — يتحقّق من صيغة `?locale=` |
| `throttling/throttle-tiers.ts` | `THROTTLE_TIERS` — أرقام حدود المعدّل بشكل `@nestjs/throttler` |
| `logging/pino-logger.config.ts` | `buildPinoOptions` — إعداد `nestjs-pino` (JSON + تنقيح) |
| `swagger/api-envelope.ts` · `swagger/api-problem-response.ts` | مساعدات decorators تُوثّق الغلاف وأشكال الخطأ في `OpenAPI` |

## خريطة الاتصال (كيف يُركَّب هذا كلّه)

يُسجَّل الجزء العالمي في `src/app.module.ts`:

```ts
providers: [
  { provide: APP_GUARD, useClass: ThrottlerGuard },       // 1) المعدّل أولًا
  { provide: APP_GUARD, useClass: JwtAuthGuard },          // 2) المصادقة (default-deny)
  { provide: APP_GUARD, useClass: PermissionsGuard },      // 3) التفويض (من access-control)
  { provide: APP_FILTER, useClass: AllExceptionsFilter },
  { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
]
```

الترتيب مقصود: throttle يطبَّق حتى على العامّ، ثم المصادقة تضع `request.user`، ثم التفويض يحلّ الصلاحيات. `PermissionsGuard` نفسه يعيش في وحدة `access-control` (لأنه يحتاج `PrismaService`)، لكنه يعمل في هذا الترتيب العالمي.

- **وارد:** كل controller/DTO في `modules/` يستخدم `@Public()`, `PaginationQueryDto`, `LocaleQueryDto`, ومساعدات Swagger.
- **صادر:** حزم `@nestjs/*` + `AppConfigService`. **لا استيراد من `modules/`.**

## التدفّقات الأساسية

### الحارس `JwtAuthGuard` (default-deny)
```
هل المسار @Public()؟ → نعم: اسمح
                     → لا: استخرج Bearer token → jwtService.verifyAsync(token, { algorithms: ['HS256'] })
                          → نجح: request.user = { id: claims.sub } ؛ اسمح
                          → فشل (توقيع/صياغة/انتهاء): 401 موحّد
```
تثبيت الخوارزمية على `HS256` صراحةً يرفض `alg: none` وخلط الخوارزميات (`doc 19 §2`).

### الفلتر `AllExceptionsFilter` (نموذج الخطأ `RFC 7807`)
كل رد غير 2xx يغادر العملية كـ `application/problem+json`. التعيينات:

| المصدر | → | الرد |
|---|---|---|
| `ValidationProblemException` | → | 422 مع مصفوفة `errors[]` (حقول مُنقَّطة) |
| `Prisma` `P2002` (فرادة) | → | 422 |
| `Prisma` `P2025` (غير موجود) | → | 404 |
| `Prisma` `P2003` (مفتاح أجنبي) | → | 409 |
| `HttpException` | → | حالته مع نوع/عنوان مطابق |
| `http-error` عميليّ (4xx مع `expose:true`) من middleware — جسم أكبر من الحدّ `413` (`doc 19 §5`) أو JSON مُشوَّه `400` | → | حالته 4xx بصيغة `RFC 7807` مع تفصيل **عامّ** (نصّ الخطأ الأصليّ لا يُفشى، إذ قد يحوي جزءًا من الجسم) — بدل وسمه خطأً خادميًّا 500 |
| غير متوقّع (يشمل `http-error` من فئة 5xx) | → | 500 (بلا تفاصيل داخلية في الإنتاج؛ السبب يُسجَّل) |

> **حدّ حجم الجسم (`doc 19 §5`):** يُسجَّل مُحلِّلا `express.json`/`urlencoded` صراحةً في الإقلاع
> (`main.ts`، `bodyParser: false` ثم حدّ `1mb`) لأنّ الافتراضيّ (~100 kB) كان سيرفض مقالًا كبيرًا صحيحًا
> (حقول Markdown حتى 256 KiB). الرفع متعدّد الأجزاء (multer، وسائط 10 MiB) مُحلِّل منفصل غير متأثّر.

### الغلاف `ResponseEnvelopeInterceptor`
```
القيمة instance من PaginatedResult ؟ → { data: value.data, meta: value.meta }
                                     → { data: value ?? null }
```
شكل واحد بلا استثناء (`D10-3`)، فيبقى تحليل العميل موحّدًا. الأخطاء تتجاوز هذا المسار (الفلتر يملكها).

## العقود والثوابت

- كل نقطة خاصّة افتراضيًا (default-deny)؛ الاستثناء صريح بـ `@Public()`.
- فشل تحقّق الـ `DTO` في `ValidationPipe` = **422** (لا `400` الافتراضي لـ `Nest`). أمّا **`400` فليس محجوزًا لطبقة واحدة**: يصدر عن تحليل المسار/الاستعلام (`ParseUUIDPipe`)، وعن رفض صريح داخل `service` (`assertEnabled`)، وعن الفرع الافتراضي لأخطاء `Prisma` غير المعروفة في هذا الفلتر، وعن `JSON` مُشوَّه. الطبقة التي ترفض أوّلًا هي التي تقرّر — [`modules/README.md`](../modules/README.md).
- الترقيم: `perPage` بحدّ أقصى 50، افتراضي page 1 / perPage 12.
- `type` في الخطأ مرجع URI نسبي (`/problems/...`) — صالح وفق `RFC 7807 §3.1` مع تأجيل المضيف المطلق (`D10-5`).

## الاختبارات وما تُثبته

`all-exceptions.filter.spec.ts` (تعيينات `RFC 7807` — يشمل تعقيم 500 دون إفشاء، وتعيين `http-error` العميليّ 413/جسم كبير و400/JSON مُشوَّه مع منع تسرّب الرسالة، وبقاء 5xx مُعقَّمًا)، `response-envelope.interceptor.spec.ts` (شكلا الغلاف)، `validation-problem.exception.spec.ts` (تسطيح مسارات الحقول). مساعدات Swagger تجعل تأكيدات `jest-openapi` تغطّي مسارات الخطأ أيضًا.

## أخطاء شائعة

- كتابة منطق عمل هنا — `common/` آليات فقط.
- الاستيراد من `modules/` — يكسر اتجاه التبعية.
- رمي 400 لفشل التحقّق بدل 422.

## المرجع الرسمي وحالة التوافق

- [Guards](https://docs.nestjs.com/guards) · [Custom decorators](https://docs.nestjs.com/custom-decorators) · [Exception filters](https://docs.nestjs.com/exception-filters) · [Interceptors](https://docs.nestjs.com/interceptors) · [Validation](https://docs.nestjs.com/techniques/validation) · [Rate limiting](https://docs.nestjs.com/security/rate-limiting)
- [RFC 7807 Problem Details](https://datatracker.ietf.org/doc/html/rfc7807)

**حالة التوافق:** `Compatible` لكل المكوّنات. الأنماط (حرّاس عامّون عبر `APP_GUARD`، فلتر استثناءات `@Catch()` عام، `NestInterceptor` لتحويل الرد، `@Public()` بالـ metadata عبر `Reflector`) هي ما يعلّمه توثيق `NestJS` الحالي؛ ونموذج الخطأ يطابق `RFC 7807`.
