# دليل المشروع — `eslammuatamed-api`

> **لمن هذا الدليل:** مهندس واجهات أمامية (Vue/Nuxt) يتعلّم الـ backend بـ `NestJS` و`Prisma`. الشرح بالعربية، وكل مُعرّف تقني يبقى بالإنجليزية كما في الكود.
> **ما الذي يصفه هذا الدليل:** الكود **الموجود في الشجرة التي تقرأها الآن**. لا يذكر ما هو
> منشور وما ينتظر إصدارًا — تلك حالة تتغيّر بينما النصّ لا يتغيّر معها، فتصير كذبًا صامتًا على
> القارئ. حالة الإصدار والنشر يملكها مستودع الوثائق الحاكمة وسجلّ الإصدارات.


## مفردات `NestJS` — اقرأها قبل أيّ شيء آخر

**بقيّة** هذا الدليل — ومن بعده `src/config/README.md` و`src/prisma/README.md` — تستعمل مفردات
الإطار دون أن تُعيد تعريفها عند كلّ ورود، لأنّها تصف هذا المستودع ولا تشرح `NestJS`. وهذا الجدول هو الحدّ الأدنى الذي يجعل ما بعده
مدخلًا مختصرًا لقادم من `Vue`/`Nuxt`: سطر لكلّ مصطلح، ثمّ **رابط التوثيق الرسمي** الذي يملك شرحه. **هذا
المستودع لا يشرح الإطار** (`principle 16`, `D00-6`) — يشرح ما فعله بالإطار. إن كان `NestJS`
معروفًا لديك أصلًا فتخطَّ الجدول إلى القسم ١ مباشرةً؛ لا شيء بعده يعتمد على قراءته سطرًا سطرًا.

**الترتيب مقصود: لا يحتاج أيّ صفّ إلى صفّ تحته ولا إلى قسم لاحق كي يُفهَم** — رُوجِعت الصفوف
واحدًا واحدًا للتأكّد، والإحالات بين قوسين تزيد تفصيلًا ولا يتوقّف عليها المعنى. *ولم يكن الأمر
كذلك: كان صفّ `DI` يذكر `PrismaService` قبل تعريفه، وصفّ `@Global` يذكر الوحدة الديناميكيّة
قبلها، وصفّ `PrismaService` يذكر دورة الحياة قبلها، وصفّ `controller` يترك «قواعد المجال» لـ
`service` لم يكن له صفّ أصلًا — وجدها قارئ بارد، فأُعيد ترتيب الصفوف وأُضيف صفّ `service`.*
الجدولان مدخل لا مرجع؛ ومتى نقص السطر فالرابط الرسمي بجانبه هو التتمّة.

| المصطلح | ما تعنيه هنا | المصدر الرسمي |
|---|---|---|
| decorator (`@…`) | دالّة تعمل **مرّة واحدة عند تعريف الصنف** (لا عند كلّ طلب)، وغالب ما تفعله هنا هو تسجيل ميتاداتا يقرأها `Nest` و`Swagger` والتحقّق لاحقًا. ولهذا `reflect-metadata` تبعيّة إنتاج | [Custom decorators](https://docs.nestjs.com/custom-decorators) |
| `service` | الصنف الذي يملك **قواعد المجال**: منطق العمل، الـ `transactions`، تحليل اللغة (تفصيله في القسم ٥). كلّ ملفّ `*.service.ts` هنا من هذا النوع | [Providers](https://docs.nestjs.com/providers) |
| `provider` | أيّ شيء مُسجَّل تحت مُعرّف (token) ليُعطيه الإطار لمن يطلبه: صنف (`useClass` — وهو الشائع: كلّ ملفّات `*.service.ts`)، أو مصنع (`useFactory` — مثل `STORAGE_ADAPTER` و`MAIL_TRANSPORT`)، أو قيمة جاهزة (`useValue`) | [Providers](https://docs.nestjs.com/providers) |
| `@Module` | صندوق تجميع: يُعلن ما يملكه (`providers`) وما يراه (`imports`) وما يُعيره لغيره (`exports`). التطبيق شجرة من هذه الصناديق جذرها `AppModule` | [Modules](https://docs.nestjs.com/modules) |
| حقن التبعيّات (DI) · `@Injectable` | لا تُنشئ الخدمات بـ `new`؛ تُعلنها في الـ constructor فيُمرّرها الإطار. وهذا هو **مقعد الاختبار**: يُمرَّر بديل مُموَّه بدل التبعيّة الحقيقيّة في اختبار الوحدة | [Providers · DI](https://docs.nestjs.com/providers#dependency-injection) |
| وحدة ديناميكيّة · `ConfigModule.forRoot({ … })` | وحدة تُبنى بمعاملات وقت التسجيل بدل أن تُستورَد ساكنة. الشكل `forRoot`/`registerAsync` الذي ستراه في `config` و`auth` | [Dynamic modules](https://docs.nestjs.com/fundamentals/dynamic-modules) |
| `@Global` | وحدة تُسجَّل مرّة في الجذر فتراها كلّ الوحدات بلا `imports` متكرّر. الـ decorator نفسه على وحدتين فقط: `AppConfigModule` و`PrismaModule`. والوحدة الديناميكيّة تبلغ الأثر نفسه بالخيار `global: true` — وهو ما يفعله `JwtModule` في `auth`. استثناء مقصود ومحدود في الحالتين، لا أسلوب عامّ | [Global modules](https://docs.nestjs.com/modules#global-modules) |
| خطّافات دورة الحياة (`onModuleInit` · `onModuleDestroy`) | دوالّ يستدعيها الإطار عند الإقلاع والإطفاء. هنا: فصل اتصال `Prisma`، وإلغاء مؤقّتات إعادة المحاولة في `mail` | [Lifecycle events](https://docs.nestjs.com/fundamentals/lifecycle-events) |
| `class PrismaService extends PrismaClient` | لا نمط جديد: صنف عميل `Prisma` المولَّد نفسه، مُغلَّفًا كـ provider ليدخل في DI ودورة حياة `Nest` | [NestJS + Prisma](https://docs.nestjs.com/recipes/prisma) |

**وطبقات دورة حياة الطلب** — الطلب يمرّ بها قبل أن يصل إلى وجهته، بالترتيب الذي يرسمه القسم ٥،
وتفصيلها هناك وفي القسم ٦.١ وفي `src/common/README.md`. هنا سطر واحد لكلٍّ، لا أكثر — والصفّ الأوّل
هو الوجهة نفسها، لأنّ بقيّة الصفوف تُعرَّف بالنسبة إليه:

| المصطلح | ما تعنيه هنا | المصدر الرسمي |
|---|---|---|
| `controller` | الصنف الذي يستقبل الطلب عند مساره (`@Get('site')`…) ويُرجِع الرد. **وجهة الطلب**، وهو هنا رفيع: يربط ويوجّه ويترك **قواعد المجال** للـ `service` — لا «بلا كود»، فالقرار ذو الشكل `HTTP` موضعه هنا (القسم ٥) | [Controllers](https://docs.nestjs.com/controllers) |
| `DTO` | صنف يصف **شكل جسم الطلب** ويحمل قواعد التحقّق كـ decorators (`@IsString()`…). ليس كيان قاعدة بيانات ولا شكل الرد | [Validation](https://docs.nestjs.com/techniques/validation) |
| `pipe` · `ValidationPipe` | يقف **بين الطلب والـ controller** فيحوّل القيمة الواردة أو يرفضها. `ValidationPipe` عامّ هنا ويفحص الـ `DTO`؛ و`ParseUUIDPipe` مثال على أنبوب مقصور على معامل واحد | [Pipes](https://docs.nestjs.com/pipes) |
| `guard` | يقرّر **هل يُسمح للطلب بالمرور أصلًا** قبل أيّ تحقّق. هنا ثلاثة عالميّة بترتيب مُلزِم (القسم ٦.١) | [Guards](https://docs.nestjs.com/guards) |
| `interceptor` | يلفّ تنفيذ المعالج فيقدر على تعديل **الرد** بعد نجاحه. هنا: `ResponseEnvelopeInterceptor` الذي يغلّف كلّ جسم `2xx` | [Interceptors](https://docs.nestjs.com/interceptors) |
| `exception filter` | يلتقط أيّ استثناء ويحوّله إلى رد خطأ موحّد. هنا: `AllExceptionsFilter` ← `RFC 7807` | [Exception filters](https://docs.nestjs.com/exception-filters) |

> **هذا القسم بلا رقم عمدًا،** ولا يُرقَّم لاحقًا: الترقيم `1`–`16` مُستشهَد به من خارج الملفّ —
> `README.md` يحيل إلى **§11** بعينه — فإقحام رقم جديد في الصدر كان سيُزيح كلّ رقم بعده ويُبطل
> تلك الإحالة بصمت. وموضعه في الصدر **ليس** تنسيقًا: كان الجدول في القسم ١٥، أي بعد ثلاثة عشر
> قسمًا اعتمدت عليه فعلًا — أوّلها القسم ٢ وأصرحها القسم ٥. *وجدها قارئ بارد في التشغيلة
> الثانية: الترتيب المُعلَن كان صحيحًا، والقراءة الخطّية لا.*

---

## 1. الغرض من المستودع

`eslammuatamed-api` هو خدمة REST مبنية بـ `NestJS 11` فوق `Prisma 7` و`PostgreSQL 16`. مسؤوليتها الوحيدة: أن تكون **مصدر الحقيقة للبيانات والمنطق** لمنصّة `eslammuatamed` (موقع شخصي/portfolio ثنائي اللغة عربي/إنجليزي + لوحة تحكّم CMS).

الخدمة تقدّم سطحين:

- **سطح عام (public)** غير مُصادَق عليه، للقراءة فقط، يُرجِع محتوى مُترجَمًا ومُحلّلًا للّغة المطلوبة (`?locale=`). تستهلكه واجهة الموقع العامة.
- **سطح إداري (`/admin`)** مُصادَق عليه بـ bearer access token، لعمليات CRUD الكاملة مع خرائط الترجمة الكاملة. تستهلكه لوحة التحكّم.

المصطلح `resolved shape` يعني: الكيان بعد «تسطيح» ترجمته إلى لغة واحدة — أي بدلًا من إرجاع كل اللغات، تُرجِع القراءة العامة نصوص اللغة المطلوبة فقط، جاهزة للعرض المباشر.

## 2. العلاقة بالمستودعات الأخرى

المنصّة ثلاثة مستودعات **مستقلّة تمامًا** (قيد دستوري دائم — [الوثيقة 00 §3](../eslammuatamed-docs/docs/00-engineering-principles.md)):

| المستودع | الدور | التواصل |
|---|---|---|
| `eslammuatamed-api` (هنا) | الـ backend: البيانات + المنطق + العقد | يُصدِّر `openapi.json` |
| `eslammuatamed-web` | الـ frontend: الموقع العام (SSR) + لوحة التحكّم (SPA) | يستهلك العقد عبر أنواع مولّدة |
| `eslammuatamed-docs` | الوثائق الحاكمة (`00–24`) — مصدر الحقيقة المعماري | لا كود |

القاعدة الحديدية: **لا مشاركة كود/أنواع/إعدادات بين `api` و`web` إطلاقًا**. القناة الوحيدة بينهما هي مستند `OpenAPI` المُصدَّر (`openapi.json`). الـ frontend لا يعرف شيئًا عن تنفيذ الـ backend، والعكس. ثمن هذا الاستقلال مقبول عمدًا: الأنواع والتحقّق يُكتبان مرّتين (مرّة لكل مستودع) — انظر `D00-5`.

هذا المستودع «مصدر الحقيقة» للعقد: يُنفَّذ العقد في الكود بـ decorators من `@nestjs/swagger`، ثم يُصدَّر إلى `openapi.json` عبر `npm run contract:export`، ثم يتبنّاه `web`. تفاصيل التدفّق في القسم 7 (عقد الواجهة الأمامية ↔ الـ API) و[الوثيقة 16 §3](../eslammuatamed-docs/docs/16-development-conventions.md).

## 3. ما الموجود في هذا المستودع

البنية التحتية العرضية كاملة (`config`, `prisma`, `common`, `contract`, `main`)، بالإضافة إلى
وحدات المجال. **فهرس الوحدات لا يُكرَّر هنا:** مصدره الوحيد
[`src/modules/README.md`](src/modules/README.md)، ومنه تصل إلى `README.md` كلّ وحدة. أيّ قائمة
ثانية هنا كانت ستفترق عن الأولى — وهذا ما حدث فعلًا قبل هذه المراجعة.

**ترقية `Prisma 7`:** `prisma` و`@prisma/client` و`@prisma/adapter-pg` و`@prisma/config` كلّها على `7.9.1`، عبر مولّد `prisma-client` الدائم ومحوّل التعريف `PrismaPg` — أي `Prisma Client → PrismaPg → pg → PostgreSQL` (`pg` تبعية غير مباشرة عبر المحوّل، لا مباشرة).

**قرارات بتركِ شيء خارج المستودع عمدًا:**
- طبقة cache للقراءة داخل الـ API (`Redis`) — فقط إذا خُرقت ميزانية الأداء `NFR-006` (الوثيقة 07 §11).
- `TOTP 2FA` — عند وجود حساب مشغّل ثانٍ حقيقي.

**ملاحظة عن `schema` مقابل الوحدات:** المخطّط يسبق الوحدة أحيانًا عمدًا — يُنشَأ الجدول أوّلًا
ثمّ تُبنى الوحدة التي تكشفه عبر `HTTP` لاحقًا. للتحقّق من حالة جدول بعينه اقرأ الشجرة، لا هذه
الفقرة: وجود مجلّد تحت `src/modules/` وتسجيله في `app.module.ts` هما الدليل القاطع على أنّ
الجدول مخدوم. ترتيب ما يُبنى لاحقًا تملكه
[الوثيقة 24 (خارطة الطريق)](../eslammuatamed-docs/docs/24-roadmap.md).

## 4. المكدّس والمكتبات المهمة (ولماذا كلٌّ منها)

`Node 24` (مثبّت في `.nvmrc` + `engines`)، `TypeScript 5.7` صارم بلا `any`.

**التبعيات وقت التشغيل (production) على هذا الأساس:**

| المكتبة | لماذا هي موجودة |
|---|---|
| `@nestjs/common` · `@nestjs/core` · `@nestjs/platform-express` | نواة إطار `NestJS` + محوّل `Express` (الـ HTTP adapter) |
| `@nestjs/config` | تحميل الإعدادات مع تحقّق class-validator عند الإقلاع (الوحدة `config`) |
| `@nestjs/jwt` | `JwtService` لتوقيع/التحقّق من access token مباشرةً (وفق توثيق مصادقة `NestJS`؛ `Passport` بديل اختياري غير مستخدَم) |
| `@nestjs/swagger` | توليد مستند `OpenAPI` — هو **العقد الرسمي** |
| `@nestjs/throttler` | تحديد المعدّل (rate limiting) بطبقات لكل نوع مسار |
| `@nestjs/schedule` | cron داخل العملية: نشر المقالات المجدولة كل دقيقة |
| `@prisma/client` | عميل `Prisma` وقت التشغيل — هو الـ data-mapper (لا طبقة repository) |
| `argon2` | تجزئة كلمات المرور بـ `argon2id` (`D19-1`) |
| `class-transformer` · `class-validator` | تحقّق الـ DTO (عبر `ValidationPipe`) وتحقّق البيئة |
| `cookie-parser` | قراءة كوكي refresh token httpOnly |
| `helmet` | ترويسات أمان HTTP افتراضية |
| `nestjs-pino` · `pino-http` | تسجيل مُهيكَل JSON مع تنقيح الحقول الحسّاسة (`D07-5`) |
| `reflect-metadata` | polyfill الميتاداتا اللازم لـ decorators في `NestJS` |
| `rxjs` | الأساس التفاعلي الذي تُبنى عليه الـ interceptors في `NestJS` (مكتبة تدفّقات — لا يلزمك إتقانها لقراءة هذا المستودع) |

> ملاحظة: مكتبات خط الوسائط (`sharp`, `@aws-sdk/client-s3`, `blurhash`, `load-esm`) هي **جزء من هذا الأساس**.

**أهم تبعيات التطوير:** `@nestjs/testing` + `jest` + `ts-jest` (اختبارات الوحدة)، `supertest` + `jest-openapi` (اختبارات e2e مع تأكيد مطابقة العقد)، `jest-mock-extended` (mocking لـ `PrismaService`)، `prisma` CLI، `eslint` + `typescript-eslint` + `prettier` + `husky` + `lint-staged` (بوابات الجودة).

سياسة إضافة أي تبعية جديدة صارمة (`principle 14`، [الوثيقة 16 §4](../eslammuatamed-docs/docs/16-development-conventions.md)): إطار مدمج ← تبعية قائمة ← وحدة من نظام الإطار ← ثم طرف ثالث بمبرّر مكتوب.

## 5. نظرة عامة على المعمارية

النمط: **modular monolith** (`D07-1`) — تطبيق `NestJS` واحد، قاعدة `PostgreSQL` واحدة، وحدات ذات حدود صريحة. لا microservices (مبالغة هندسية لمنصّة بمشغّل واحد).

التركيب الطبقي لكل طلب:

```
HTTP → Guard(s) → Pipe (ValidationPipe) → Controller → Service → PrismaService → PostgreSQL
                                              │             │
                                        (رفيع: يربط        (يملك منطق العمل،
                                         الـ DTO بالـ        الـ transactions،
                                         service فقط)        وتحليل اللغة)
```

- **Controllers رفيعة:** توجيه، ربط DTO للتحقّق، decorators لـ Swagger. **لا قواعد مجال** — وهذا هو الحدّ، لا «لا كود». القرار ذو الشكل `HTTP` (ترجمة `null` إلى `404`، اختيار `200` بدل `201` عند التكرار، كتابة كوكي `refresh`) موضعه الصحيح هو الـ `controller`. الجدول الكامل لكلّ موضع من هذه المواضع، ولماذا `preview` أخصّها، في [`src/modules/README.md`](src/modules/README.md).
- **Services تملك المنطق:** قواعد العمل، الـ transactions، تحليل اللغة. وهي وحدة الاختبار (`principle 13`).
- **لا طبقة repository (`D07-2`):** الـ services تحقن `PrismaService` مباشرة. `Prisma` نفسه هو التجريد؛ ولفّه في repositories تمريرية هو الطبقية الاحتفالية التي يمنعها `D00-3`. مقعد الاختبار (seam) هو حقن `PrismaService` نفسه.
- **اتجاه التبعية أحادي:** `services` لا تستورد `controllers`؛ الوحدات تتفاعل عبر خدمات مُصدَّرة صراحةً، لا عبر نماذج `Prisma` لوحدة أخرى؛ و`common/` لا يستورد من `modules/` أبدًا.

خريطة الطبقات على القرص في [`src/` — انظر الوثيقة 08](../eslammuatamed-docs/docs/08-folder-structure.md) وملفات `README.md` داخل كل مجلد:

| المجلد | المسؤولية | دليله |
|---|---|---|
| `src/config` | مخطّط البيئة + الإعداد المُتحقَّق | [`src/config/README.md`](src/config/README.md) |
| `src/prisma` | `PrismaService` العام (الـ data-mapper) | [`src/prisma/README.md`](src/prisma/README.md) |
| `src/common` | الآليات العرضية فقط (guards, filters, interceptors, decorators, dto, pagination, http, logging, swagger, throttling) | [`src/common/README.md`](src/common/README.md) |
| `src/contract` | تصدير مستند `OpenAPI` (العقد) | [`src/contract/README.md`](src/contract/README.md) |
| `src/modules` | وحدات المجال (الشكل القانوني للوحدة) | [`src/modules/README.md`](src/modules/README.md) |
| `prisma/` | `schema.prisma` + migrations + `seed.ts` | [`prisma/` موصوف في الوثيقة 09](../eslammuatamed-docs/docs/09-database-design.md) |
| `test/` | اختبارات e2e (اختبارات الوحدة بجوار مصادرها) | [`test/README.md`](test/README.md) |

## 6. مسارات التشغيل الرئيسية وقت الطلب

### 6.1 دورة حياة الطلب والحرّاس العامّون
تُسجَّل ثلاثة حرّاس عامّون في `src/app.module.ts` بترتيب التنفيذ التالي (الترتيب يهمّ):

```
ThrottlerGuard → JwtAuthGuard → PermissionsGuard → (Controller)
```

1. `ThrottlerGuard`: يطبّق حدّ المعدّل حتى على المسارات العامّة.
2. `JwtAuthGuard` (default-deny): كل مسار خاصّ افتراضيًا؛ يتحقّق من access token ويضع `request.user`. مسار مُعلَّم `@Public()` يتخطّاه.
3. `PermissionsGuard`: يحلّ صلاحيات المستخدم من قاعدة البيانات في كل طلب ويقارنها بالصلاحية المطلوبة `@RequirePermission('<resource>.<action>')`.

ثم يمرّ الرد عبر `ResponseEnvelopeInterceptor` (يغلّف كل جسم 2xx في `{ data }` أو `{ data, meta }`)، وأي خطأ يمرّ عبر `AllExceptionsFilter` (يحوّله إلى `application/problem+json` وفق `RFC 7807`).

### 6.2 المصادقة والتفويض (auth flow)
- **الدخول:** `POST /api/v1/auth/login` → تحقّق كلمة المرور بـ `argon2id` (فشل موحّد لمنع تعداد المستخدمين) → إصدار access token (JWT، `sub` فقط، 15 دقيقة) + refresh token (قيمة عشوائية 256-bit، تُخزَّن مُجزّأة بـ HMAC-SHA256، تُسلَّم ككوكي `httpOnly; SameSite=Lax` بمسار `/api/v1/auth`).
- **التجديد:** `POST /api/v1/auth/refresh` → تدوير الـ refresh token مع كشف إعادة الاستخدام عبر `familyId` (تقديم رمز مُبطَل = إشارة سرقة → إبطال العائلة كلها).
- **التفويض:** كل نقطة إدارية تُعلن صلاحيتها؛ يحلّها `PermissionsGuard` من قاعدة البيانات لحظيًّا (تغيير الصلاحيات يسري فورًا دون انتظار انتهاء الـ token). الدور `OWNER` يملك المنحة الجامحة `*`.

التفاصيل الكاملة في [`src/modules/auth/README.md`](src/modules/auth/README.md) و[`src/modules/access-control/README.md`](src/modules/access-control/README.md).

### 6.3 الوصول إلى قاعدة البيانات
كل service يحقن `PrismaService` (نموذج data-mapper). الاتصال **كسول (lazy)**: لا `$connect` عند الإقلاع، فيفتح `Prisma` المجمّع عند أول استعلام — ما يتيح تصدير العقد وتشغيل الاختبارات دون قاعدة بيانات (`constitution rule 4`). التفاصيل في [`src/prisma/README.md`](src/prisma/README.md).

### 6.4 تحليل اللغة (i18n)
الترجمات في جداول ترجمة منفصلة لكل كيان (`D09-1`). طبقة الـ service تملك تحليل اللغة:
- **قراءة عامة:** `?locale=` مُتحقَّق منه ضدّ اللغات المُفعّلة (`LocalesService.assertEnabled`) → شكل مُسطَّح للّغة الواحدة. **لا رجوع صامت** إلى لغة أخرى: ترجمة مفقودة تبقى مفقودة (404 عند الوصول المباشر).
- **قراءة إدارية:** خريطة الترجمة الكاملة (لتحرير جنب-إلى-جنب).

### 6.5 الوسائط: وحدة `media`
وحدة `media` تُدير الرفع والمعالجة والتخزين وحلّ الـ descriptors.

**القاعدة:** القراءة العامّة تُبقي حقل `*Id` الخام وتُضيف **بجانبه** descriptor مُحلَّلًا (URL على
أصل الوسائط + أبعاد + `blurhash` + نصّ بديل للّغة، قابل لـ `null`). تسري على:
`Article.coverImageId` → `coverImage` · `*.ogImageId` → `ogImage` · gallery `mediaAssetId` →
`mediaAsset` · `Testimonial.avatarId` → `avatar` · `SiteSettings.portraitAssetId` → `portrait`.

**والاستثناء الوحيد، وهو في العقد لا في الوصف:** `SiteSettings.resumeAssetId` **لا يظهر أصلًا** في
`PublicSiteSettingsEntity`؛ القراءة العامّة تُرجِع `resumeAsset` (descriptor لملفّ `PDF`) **بدلًا
منه** لا بجانبه. وهو أيضًا الحقل الوحيد الذي يُحلّ بـ `resolvePdf` لا `resolveImage`.

**والسطح الإداريّ ليس «خامًّا دائمًا»:** `AdminSiteSettingsEntity` يحمل `portrait` مُحلَّلًا إلى
جانب `portraitAssetId` و`resumeAssetId` الخامّين. أمّا بقيّة الكيانات الإدارية فخامّة فعلًا.
*راجِع `openapi.json` عند الشكّ — هو العقد، وهذه الفقرة وصفٌ له.* التفاصيل الكاملة في
[`src/modules/media/README.md`](src/modules/media/README.md).

### 6.6 النشر المجدول
`@nestjs/schedule` يشغّل cron داخل العملية كل دقيقة يرفع المقالات `SCHEDULED` المستحقّة (`publishAt <= now`) إلى `PUBLISHED` باستعلام واحد idempotent (`D07-3`). صحيح لنسخة API واحدة؛ التوسّع الأفقي مستقبلًا يحتاج قفلًا موزّعًا (موثّق في الوثيقة 07 §5).

### 6.7 نموذج الخطأ والغلاف
- **الخطأ:** `AllExceptionsFilter` يحوّل كل استثناء إلى `RFC 7807 problem+json`، ويعيّن أكواد `Prisma` المعروفة (`P2002`→422، `P2025`→404، `P2003`→409) لأكواد HTTP ذات معنى، ويُخفي التفاصيل الداخلية في الإنتاج.
- **الغلاف:** `ResponseEnvelopeInterceptor` يوحّد كل رد ناجح: قائمة → `{ data, meta }`، وأي شيء آخر → `{ data }` (`D10-3`).

## 7. عقد الواجهة الأمامية ↔ الـ API

التدفّق المُعتمد الوحيد لعبور تغيير في العقد حدود المستودعات ([الوثيقة 16 §3](../eslammuatamed-docs/docs/16-development-conventions.md)):

```
1. تصميم التغيير في الوثيقة 10 (API Design)
2. تنفيذه في الـ API: decorators من @nestjs/swagger + class-validator
3. npm run contract:export  →  يُولّد openapi.json (بلا قاعدة بيانات)
4. يتبنّاه web: نسخ openapi.json + npm run api:types + التكيّف — في commit ذرّي واحد
```

`openapi.json` هو الأثر (artifact) الرسمي، يُبنى من نفس إعداد `buildOpenApiConfig()` المستخدَم في `/docs` UI. القاعدة الحرجة: **يجب أن يعمل `contract:export` دون قاعدة بيانات** (يعتمد على الاتصال الكسول لـ `Prisma`).

## 8. نموذج المصادقة والتفويض (ملخّص)

| البُعد | القرار | المرجع |
|---|---|---|
| تجزئة كلمة المرور | `argon2id` (64 MiB, t=3, p=4) | `D19-1` |
| access token | JWT HS256، `sub` فقط، 15 دقيقة، في الذاكرة عميلًا | `D19-8` |
| refresh token | عشوائي 256-bit، مُجزّأ HMAC-SHA256 بـ pepper، كوكي `httpOnly; Secure(prod); SameSite=Lax` بمسار `/api/v1/auth` | `D19-2/D19-3` |
| التفويض | default-deny عام + `@Public()`؛ RBAC ديناميكي قائم على الصلاحيات، يُحلّ من DB لكل طلب؛ منحة `*` لـ `OWNER` | `D19-8` |

## 9. نموذج قاعدة البيانات والتخزين

- **الـ ORM:** `Prisma 7.9` فوق `PostgreSQL 16` (المحرّك الأصلي أُزيل؛ المحوّل هو `@prisma/adapter-pg`). نماذج PascalCase / حقول camelCase؛ أسماء الجداول snake_case عبر `@map`/`@@map` (`D09-1`). مفاتيح `UUIDv7` (`D09-2`). كل جدول يحمل `createdAt`/`updatedAt`.
- **الترجمة:** جداول ترجمة منفصلة لكل كيان؛ فرادة الـ slug لكل لغة (`@@unique([locale, slug])`).
- **البحث النصّي الكامل (FTS):** عمود `tsvector` + فهرس `GIN` على `article_translations`، يُضاف بـ migration يدوي (`D09-6`) لأن `Prisma` لا يعبّر عن الأعمدة المولّدة.
- **التخزين:** التخزين الفعلي وراء واجهة `StorageAdapter` (`D07-4`) قائم: `LocalStorageAdapter` للتطوير/الاختبار و`R2StorageAdapter` المتوافق مع `S3` على `Cloudflare R2` للإنتاج، يُختاران بـ `STORAGE_DRIVER`. التفاصيل في [`src/modules/media/README.md`](src/modules/media/README.md).
- المخطّط الكامل موثّق في [الوثيقة 09 (Database Design)](../eslammuatamed-docs/docs/09-database-design.md) — لا نكرّره هنا.

## 10. البيئة والإعداد

كل متغيّر **مُتحقَّق منه عند الإقلاع** في `src/config/env.validation.ts`؛ متغيّر مفقود أو غير صالح يُفشِل الإقلاع فورًا (لا خطأ 500 بعد ساعة). **القائمة الكاملة والمُلزِمة هي `.env.example` (عقد الإعداد) ومخطّط `env.validation.ts` وحدهما** — وما يلي عيّنة للتوجيه لا حصر، لأنّ سرد المتغيّرات في موضعين يفترق عند أوّل إضافة. المجموعات الأكبر:

`NODE_ENV`, `PORT` · `DATABASE_URL` · `CORS_ORIGIN` · `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL`, `REFRESH_TOKEN_TTL_DAYS`, `REFRESH_TOKEN_PEPPER`, `PREVIEW_TOKEN_SECRET`, `COOKIE_DOMAIN` · `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD` · `STORAGE_DRIVER`, `STORAGE_LOCAL_DIR`, `PUBLIC_MEDIA_URL`.

> وإلى جانبها مجموعتان لا تظهران أعلاه: `PUBLIC_WEB_URL` (أصل الموقع الذي يعرض صفحة المعاينة)،
> ومجموعة البريد `SMTP_*` مع `CONTACT_NOTIFICATION_TO` — وهي مُتحقَّق منها كغيرها، لكنّها اختياريّة
> ومُغلَقة افتراضيًّا خلف `SMTP_ENABLED` (تفصيلها في [`src/modules/mail/README.md`](src/modules/mail/README.md)).
>
> `STORAGE_*` تستخدمها وحدة `media` الآن، و`S3_*` (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`) مطلوبة عند `STORAGE_DRIVER=s3` (الإنتاج). و`PREVIEW_TOKEN_SECRET` مُتحقَّق منه عند الإقلاع كغيره. **والقاعدة هنا بنيويّة لا حالة:** التحقّق يملكه
`src/config` وحده، فهو لا يسأل أيّ وحدة تستهلك المتغيّر ولا متى بدأت — متغيّر مُعلَن يُتحقَّق منه، وانتهى.
*(كان هذا الموضع يصنّف وحدة `preview` بحالة تسليم. صنف من الوصف يتعفّن بالتعريف، وقد تعفّن فعلًا —
وهو ما وجده قارئ بارد. والمقصود بالتحديد **حالة الإصدار والنشر ودورة حياة الوحدة**، لا وصف ما
يفعله الكود: «هذه الوحدة تُرسِل بريدًا» وصفٌ تتحقّق منه من الشجرة، أمّا «هذه الوحدة `Planned`» فحالةٌ
تتعفّن. ودليلُ وجود أيّ وحدة هو مجلّدها تحت `src/modules/` وتسجيلها في `app.module.ts`، كما يقول
القسم ٣ — اقرأ الشجرة، لا فقرةً عنها.)* التفاصيل في [`src/config/README.md`](src/config/README.md).

لا `Docker` في المشروع (توجيه المالك، `D16-5`): `PostgreSQL` أصلي محليًّا، ودور `eslammuatamed` بلا كلمة مرور على المنفذ `5432`.

> **في الإنتاج يجب أن يكون مضيف `DATABASE_URL` هو `127.0.0.1` حرفيًّا، لا `localhost` (`D23-24`).**
> *(`pg_hba.conf` هو جدول `PostgreSQL` الذي يُطابق **عنوان مصدر الاتصال** بطريقة تحقّق: `trust`
> تعني «ادخل بلا كلمة مرور»، و`scram-sha-256` تعني «قدّم كلمة مرور». هذا القدر يكفي لفهم القاعدة
> أدناه؛ إدارة `PostgreSQL` نفسها ليست من عمل هذا المستودع.)*
> قاعدة `trust` في `pg_hba.conf` على الخادم مقصورة على `IPv4` عند `127.0.0.1/32`، بينما
> `PostgreSQL` يستمع على العائلتين. و`localhost` يُحلّ إلى `::1` أوّلًا، فيقع الاتصال على
> `host all all ::1/128 scram-sha-256` — والدور بلا كلمة مرور يقدّمها، فيفشل `SASL`.
>
> **لماذا لم يظهر هذا من قبل:** `Prisma 6` كان يحلّ المضيف داخل محرّكه المكتوب بـ `Rust`
> فيختار `IPv4`. أمّا `Prisma 7` فيمرّ عبر `PrismaPg` ثم `node-postgres`، وهو يأخذ `::1`.
> فالعطل اقتران بنيةٍ تحتية كشفه تبديل المُشغِّل، لا خطأ في الإعداد أو في الكود — وقد أوقف
> الإنتاج فعليًّا بتاريخ `2026-08-14`.
>
> **بيئة التطوير المحلّية تثق بالعائلتين معًا**، فـ `localhost` يعمل هنا بلا مشكلة — وهذه
> بالضبط هي المفارقة التي جعلت العادة تنتقل إلى الخادم دون أن ينتبه أحد. لا تنقلها.
> التفاصيل في [الوثيقة 23 §3](../eslammuatamed-docs/docs/23-deployment.md).

## 11. التطوير والاختبار محليًّا · بوابات الجودة · النشر

**أوامر التطوير** (`package.json`):
```bash
npm run start:dev        # المنفذ 3001، Swagger UI على /docs
npm run lint             # eslint --fix
npx tsc --noEmit         # فحص الأنواع
npm test                 # اختبارات الوحدة (jest) — بلا قاعدة بيانات
npm run contract:export  # → openapi.json (بلا قاعدة بيانات)
npx prisma migrate deploy && npm run db:seed   # تهيئة قاعدة البيانات المحلّية
npm run test:e2e         # يحتاج PostgreSQL (Supertest + jest-openapi)
```

**البوابات (بلا قاعدة بيانات — لأن الاتصال كسول):** `lint`, `tsc --noEmit`, `npm test`, `contract:export`.

**CI** (`.github/workflows/ci.yml`) مساران:
- `verify`: lint · typecheck · unit · تصدير العقد (بلا DB) · `npm audit --audit-level=high`
  **حاجب** (بلا `continue-on-error`) · **`shellcheck` على `scripts/deploy/remote-cutover.sh`**.
- `e2e`: خدمة `postgres:16` ثمّ `npm ci` → `prisma generate` → `test:e2e`. **ولا خطوة `migrate deploy`
  ولا `db:seed` في سير العمل:** مِعمار الاختبارات يملك قاعدة بياناته لكلّ تشغيل — يُنشئها ويُرحّلها
  ويبذرها ويُسقطها بنفسه (`D18-8`)، فمالك التهيئة واحد لا اثنان. تفصيل المِعمار في
  [`test/README.md`](test/README.md).

> **بوابة `shellcheck` صريحة وتفشل بوضوح.** كانت قبل ذلك تُشغَّل انتهازيًّا داخل اختبار
> انحدار: إن لم يكن الملفّ التنفيذي موجودًا **مرّت البوابة**. أداة قياس تُبلِّغ «نظيف» دون أن
> تقيس شيئًا ليست بوابة. الخطوة الحالية تتحقّق من وجود `shellcheck` وتُنهي التشغيل بـ
> `exit 1` مع تعليق `::error::` إن غاب، ثم تفحص سكربت التحويل فعليًّا.

**خط الإصدار** (`.github/workflows/deploy.yml`) يعمل على `push: main` وحده، ورسمه الحالي:

```
preflight  →  (verify  ∥  e2e)  →  deploy
```

`verify` و`e2e` يعملان **بالتوازي**: لم يكن `e2e` يستهلك أيّ بيانات من `verify`، فالقيد كان
ترتيبًا محضًا. **لم يُحذف شيء ولم تُضعَف بوابة**: كلا الوظيفتين ما زالت تعمل على `SHA` الإصدار
نفسه، و`deploy` ما زال يشترط `needs: [preflight, verify, e2e]`، فسقوط `verify` يمنع النشر تمامًا
كما كان. يبقى `needs: verify` قائمًا في `ci.yml` عمدًا: هناك الفشل حالة عاديّة فيُجدي التسلسل،
أمّا على خط الإصدار فالشجرة اجتازت `ci.yml` أصلًا فالفشل هو النادر بينما التأخير يُدفع كلّ مرّة.

> **قياس أم توقُّع؟ — قِيس فعلًا في `2026-08-15`.** الرقم `≈131` ثانية كان **متوقَّعًا**
> (`projected`) وقد **سقط**؛ نشرة `main` الحقيقيّة قاست البديل. المقارنة الآن **A/B بين
> تشغيلين حقيقيّين** بالتعريف نفسه (`run_started_at` ← أوّل حالة `waiting` على الـ deployment):
>
> | التشغيل | الرسم | الزمن حتى بوّابة الموافقة |
> | --- | --- | --- |
> | قبل | **متسلسل** — `e2e` بدأ بعد انتهاء `verify` بثلاث ثوانٍ | **`207` ثانية** |
> | بعد | **متوازٍ** — تداخل `84` ثانية | **`142` ثانية** |
>
> **التوفير المحقَّق: `65` ثانية — `31.4 %`.** وبتعريف ثانٍ (من بدء أوّل وظيفة حتى انتهاء آخر
> وظيفة قبل البوّابة) يقرأ التشغيلان نفسهما `203 → 139` ثانية = `64` ثانية (`31.5 %`) — والرقم
> `203` الذي كان مذكورًا هنا ينتمي إلى هذا التعريف الثاني. **عرِّف المقياس قبل المقارنة؛ رقم
> بلا تعريفه غير قابل للمقارنة.** ويُستبعَد من كلّ ما سبق **زمن انتظار موافقة المالك**
> (`1 701` ثانية في تلك النشرة): هو وقت بشريّ لا مقياس أداء.

**`verify` في خط الإصدار ليس نسخة زائدة.** `ci.yml` **لا** يعمل على `push: main` عمدًا، فوظيفة
`verify` داخل `deploy.yml` هي **التحقّق الوحيد من `SHA` الإصدار بعينه**، وهي أقوى: تحمل حارس
هجرات البحث `guard:fts`. الاحتفاظ بها قرار **سلامة مؤجَّل بالدليل**، لا تحسين لم يكتمل: إسقاطها
يتطلّب برهانًا داخل خط التشغيل أنّ شجرة `main` تطابق شجرةً اجتازت `ci.yml` — وبما أنّ الترقية
تتمّ بـ `squash` (`D17-4`) فلا بدّ أن يكون الرابط **بصمة شجرة** لا `SHA`.

**تحليل أمنيّ ساكن — `CodeQL`** (`.github/workflows/codeql.yml`): يحلّل
`javascript-typescript` (مصدر الـ `API`) و`actions` (ملفّات سير العمل نفسها، لأنّ تاريخ العلل
في هذا المستودع يعيش في `YAML` بقدر ما يعيش في `TypeScript`). يعمل على `push: main` و
`pull_request` و أسبوعيًّا. **استشاريّ**: ليس فحصًا مطلوبًا، وترقيته إلى مطلوب قرار مالك مستقلّ.
النتيجة الحاليّة **صفر اكتشافات**، وقد جرى **ضبط سالب** يُثبت أنّ الأداة تُطلِق فعلًا على عيب
مزروع في كلتا اللغتين — وإلّا لكان «صفر» مجرّد أداة صامتة.

> نتائج `CodeQL` على `pull_request` تظهر على مرجع الـ `PR` نفسه؛ ظهورها في تبويب `Security`
> للمستودع مرتبط بفرعه الافتراضي. الفرق **متوقَّع بالتصميم** ولا يُقرأ بوصفه نقصًا في التغطية.

**`Dependabot`** (`.github/dependabot.yml`): تحديثات الإصدارات **فعّالة** منذ وصول الملفّ إلى
`main`، وتستهدف `dev` أسبوعيًّا (الاثنين `06:00` `Europe/Berlin`، حدّ `5`). الإصلاحات الأمنيّة
**التلقائيّة** تبقى معطَّلة عمدًا: هي مفتاح منفصل يتجاهل `target-branch` وكان سيفتح طلبات على
`main` مباشرةً. التنبيهات مفعَّلة (`0` مفتوحة). لا `auto-merge` ولا تجميع (`grouping`) — التجميع
مؤجَّل لعدم كفاية الدليل، لا رفضًا له. تحديثات `typescript` **الكبرى متجاهَلة**، وتسري القاعدة
حين يبلغ هذا الفرع `main`، لأنّ `Dependabot` يقرأ إعداده من الفرع الافتراضي.

**تعريف الإنجاز (Definition of Done):** المطابقة للوثائق الحاكمة (أو تُنقَّح الوثيقة أولًا)، ونجاح lint/typecheck/tests، وتغطية اختبارية للسلوك الجديد. التفاصيل في [الوثيقة 16 §5](../eslammuatamed-docs/docs/16-development-conventions.md).

**النشر:** لا أوسمة (`tags`). الدفع إلى `main` — أو دمج ترقية `dev → main` — يُشغّل `deploy.yml`
على الـ `SHA` المحدَّد بعينه، والنشر على `Contabo VPS` (لا `Docker`). **وقد يُشغَّل تشغيلان لنفس
الـ `SHA`:** حدث الدفع على `main` يسقط أحيانًا، فيلتقط `deploy-fallback.yml` دمج الـ PR ويُرسِل
نفس الخطّ بـ `workflow_dispatch`. الزوج مُتماثل بالبناء — مجموعة تزامن واحدة، و`preflight` يُصدر
`already-deployed` للتشغيل الثاني — فلا يبلغ الكتابةَ على الخادم إلا تشغيل واحد على الأكثر. وظيفة التحويل
مربوطة ببيئة `production` في `GitHub`، فلا يقع أي تعديل على الخادم قبل موافقة المالك
(`D23-16`, `D23-17`). إرفاق `openapi.json` كأثر إصدار **عمل مؤجَّل** بعد التخلّي عن الأوسمة.

**بوابة التحويل (`cutover`) لا تعتمد على `liveness` وحدها (`D23-23`).** كانت البوابة حتى
`2026-08-14` استدعاءً واحدًا لـ `/api/v1/health`، وهو فحص **حياة**: يُرجع `200` من عملية تستمع
على المنفذ ولو كانت قاعدة البيانات غير متاحة أصلًا. وبما أنّ **التراجع التلقائي معلَّق على
البوابة نفسها**، فإنّ بوابةً تمرّ زورًا تُبطِل التراجع في اللحظة التي يُحتاج فيها بالضبط — وهذا
ما حدث: إصدارٌ كانت كلّ نقاطه المعتمدة على قاعدة البيانات تُرجع `500` قُبِل على أنّه سليم وبقي
حيًّا.

الإصدار يُقبَل الآن فقط إذا نجحت **الفحوص الأربعة** مجتمعةً:

| الفحص | النقطة | ما يُثبته |
| --- | --- | --- |
| `liveness` | `/api/v1/health` | العملية تستمع |
| `readiness` | `/api/v1/health/ready` | ينفّذ استعلامًا فعليًّا ويُرجع **`503`** إذا تعذّر الوصول إلى قاعدة البيانات |
| `smoke` | `/api/v1/settings/site` | الـ `ORM` يخدم بيانات حقيقية |
| `smoke` | `/api/v1/projects` | قراءة ثانية مدعومة بقاعدة البيانات، بشكل قائمة |

**العنوان الأساسي، لا العناوين الكاملة.** الفحوص الأربعة تُركَّب من عنوان أساسي واحد —
`http://127.0.0.1:3001/api/v1` (`remote-cutover.sh:26`) — يليه المسار النسبيّ. المنفذ `3001`
والبادئة `/api/v1` ينشآن من `setGlobalPrefix('api')` و`enableVersioning` في `src/main.ts`، ولا
يجوز إسقاط أيٍّ منهما. **تحذير:** تطبيق `Nuxt` يستمع على المنفذ `3000` من الخادم نفسه، فطلبٌ
موجَّه إلى `3000` يُرجع `200` مع `HTML` — نتيجة خضراء كاذبة. لذلك **رمز الحالة وحده ليس دليلًا**
على بلوغ النقطة المقصودة في أيّ تحقّق يدويّ؛ أكِّد جسم الاستجابة. السكربت نفسه محصَّن بالبناء
(عنوان أساسيّ مثبَّت + `curl --fail`). التفصيل في
[`scripts/deploy/README.md`](scripts/deploy/README.md).

**دلالات التراجع التلقائي.** عند فشل البوابة يُعيد النشر توجيه `current` إلى الإصدار السابق
ويُعيد تشغيل الخدمة، ثمّ **يتحقّق من هدف التراجع بالفحوص الأربعة نفسها** — فـ«تراجَع بنجاح»
تعني «سليم فعلًا»، لا «يستمع على المنفذ». وإن لم يوجد إصدار سابق سليم يتوقّف النشر معلنًا
`MANUAL INTERVENTION REQUIRED` بدل ترك إصدارٍ معطوب حيًّا. الهجرات **تُصحَّح بالتقدّم لا
بالتراجع** (الوثيقة 09 §6): إعادة الرابط الرمزي إلى الوراء لا تُرجِع المخطَّط.

**تحذير التنظيف ليس فشل إصدار.** تقليم الإصدارات القديمة يجري **بعد** التحقّق من سلامة
التحويل، فلا يمكنه أن يُفشِل إصدارًا ناجحًا. كان قبل ذلك يخرج بالرمز `123` عند خطأ صلاحيات على
ملفّ يملكه `root`، فيُبلِّغ عن «فشل» بسبب مشكلة تنظيف بينما العطل الحقيقي يمرّ دون إبلاغ. صار
الآن **غير قاتل وغير صامت**: ما يتعذّر حذفه يُذكر بالاسم في علامة `PRUNE_INCOMPLETE:` مع تحذير
`::warning::` وسطر `cleanup:` مستقلّ في ملخّص النشر. يُقبل التحذير فقط ما دام الإصدار الجديد
سليمًا بذاته والرابط الرمزي صحيحًا والفحوص الأربعة ناجحة.

المجلّد الوحيد الذي كان يُطلق هذا التحذير كان أقدم من مستخدم `deploy`: مملوكًا لـ `root:root`
بمحتوًى `ubuntu:ubuntu`، فتعذّر على خطّ النشر حذفه. أُزيل يدويًّا بصلاحية `root` خارج خطّ النشر.
**والسبب الصحيح لاختفائه يجب ألّا يُختصر خطأً:** التقليم
يعمل **بعد** إنشاء مجلّد الإصدار الجديد، فمنظومة `KEEP_RELEASES=5` يكون لديها عادةً مرشَّح
للتقليم في النشرة التالية — مجموعة التقليم **ليست فارغة**. الاختفاء سببه **الملكيّة وقابليّة
الكتابة**، لا بلوغ العدد حدّ `KEEP_RELEASES`. وبعد الإزالة جرى مسح لشجرة الإصدارات كاملةً فلم
يُوجد مسار واحد خارج ملكيّة `deploy` أو خارج قابليّة الكتابة. **حالة الدليل:** الغياب المستقبليّ
لـ `PRUNE_INCOMPLETE` **مُثبَت بالبناء**، لا مقيسًا في زمن التشغيل — النشرة الحقيقيّة التالية هي
التي تقيسه.

التفاصيل الكاملة في [الوثيقة 23 (Deployment)](../eslammuatamed-docs/docs/23-deployment.md)
و[الوثيقة 18 §4b](../eslammuatamed-docs/docs/18-testing-strategy.md).

## 12. قرارات عرضية (cross-cutting)

- **Documentation First (`principle 1`):** لا كود لقدرة قبل اعتماد وثيقتها الحاكمة؛ الكود لا يسبق الوثائق صامتًا.
- **API First (`principle 3`):** العقد يُصمَّم قبل تنفيذه.
- **Official Documentation Over Habit (`principle 16`, `D00-6`):** الكود يتبع **التوثيق الرسمي الحالي** للأداة؛ نمط تجاوزه التوثيق = عيب حتى لو عمل. (مثال المشروع: التحقّق من الـ JWT مباشرةً بـ `JwtService` وفق توثيق مصادقة `NestJS` — وهو نمط مدعوم رسميًّا — دون طبقة `Passport` الاختيارية التي لا يحتاجها المشروع.)
- **Reasoned Dissent Before Assent (`principle 17`, `D00-7`):** الاعتراض المُبرَّر بأدلّة يُطرح قبل التنفيذ؛ ثم قرار المالك يُنفَّذ ويُسجَّل الخلاف الجوهري.

## 13. ملخّص مراجعة التوافق (Compatibility Review)

قِيس كل نمط جوهري ضدّ التوثيق الرسمي بالإصدار المُثبَّت. التصنيفات: `Compatible` (مطابق) / `Intentional documented deviation` (انحراف مقصود موثّق) / `Unexplained deviation` (انحراف غير مُفسَّر). **لم يُرصَد أي انحراف غير مُفسَّر في هذا الأساس.**

| النمط | الملفات الأساسية | التصنيف | المرجع الرسمي والحاكم |
|---|---|---|---|
| تحقّق مباشر من الـ JWT بـ `JwtService` (`Passport` بديل اختياري غير مستخدَم) | `common/guards/jwt-auth.guard.ts`, `modules/auth/*` | `Compatible` (مدعوم رسميًّا؛ ليس انحرافًا) | [NestJS Authentication](https://docs.nestjs.com/security/authentication) · القرار `D00-6` |
| تجزئة `argon2id` (64 MiB/t=3/p=4) | `modules/auth/hashing/*` | `Compatible` (يفي/يفوق حدّ OWASP الأدنى لـ Argon2id) | [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) · `D19-1` |
| حقن `PrismaService` مباشرة، بلا repository | كل `*.service.ts` | `Compatible` (وصفة NestJS+Prisma الرسمية تحقنه مباشرة) | [NestJS Prisma recipe](https://docs.nestjs.com/recipes/prisma) · `D07-2`/`D00-3` |
| اتصال `Prisma` كسول (بلا `$connect` عند الإقلاع) | `prisma/prisma.service.ts` | `Compatible` (`Prisma` يدعم الاتصال الكسول أصلًا؛ ويحقّق `constitution rule 4`، لا يخالفها) | [Prisma connection management](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-management) · `constitution rule 4` |
| `ValidationPipe` عام (whitelist + forbid + transform) | `main.ts`, كل `dto/*` | `Compatible` | [NestJS Validation](https://docs.nestjs.com/techniques/validation) |
| أخطاء `RFC 7807` عبر exception filter عام | `common/filters/*`, `common/http/*` | `Compatible` | [RFC 7807](https://datatracker.ietf.org/doc/html/rfc7807) · [NestJS Exception filters](https://docs.nestjs.com/exception-filters) |
| حرّاس عامّون عبر `APP_GUARD` + `@Public()` بالـ metadata | `app.module.ts`, `common/decorators/*` | `Compatible` | [NestJS Guards](https://docs.nestjs.com/guards) |
| إعداد مُتحقَّق منه عند الإقلاع | `config/*` | `Compatible` | [NestJS Configuration](https://docs.nestjs.com/techniques/configuration) |
| `@nestjs/throttler` بطبقات | `app.module.ts`, `common/throttling/*` | `Compatible` | [NestJS Rate limiting](https://docs.nestjs.com/security/rate-limiting) |
| cron داخل العملية للنشر | `modules/articles/articles.scheduler.ts` | `Compatible` + تحذير توسّع موثّق | [NestJS Task scheduling](https://docs.nestjs.com/techniques/task-scheduling) · `D07-3` |
| FTS عبر `$queryRaw` مُعامَل | `modules/articles/articles.service.ts` | `Compatible` (استعلام خام مُعامَل ضدّ الحقن) | [Prisma raw queries](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries) |
| إصدارات URI `/api/v1` + بادئة عامة | `main.ts` | `Compatible` | [NestJS Versioning](https://docs.nestjs.com/techniques/versioning) |
| `@nestjs/swagger` + تصدير العقد | `contract/*`, كل controller | `Compatible` | [NestJS OpenAPI](https://docs.nestjs.com/openapi/introduction) |

كل بند مشروح بتفصيله (الكود الفعلي مقابل المصدر) في `README.md` للمجلد المعني.

## 14. مخاطر معلومة وعمل مؤجَّل

- **الوسائط:** القراءات العامة تُرجِع `*Id` خامة **مع** descriptor مُحلّل بجانبها (وحدة `media`) — عدا `SiteSettings.resumeAssetId`، فيُستبدَل بـ `resumeAsset` ولا يظهر خامًّا (القسم ٦.٥).
- **cron داخل العملية:** صحيح لنسخة واحدة فقط؛ التوسّع الأفقي يحتاج قفلًا.
- **تحذير إعداد محلّي:** الدور بلا كلمة مرور يحتاج سطر `trust` في `pg_hba.conf` (انظر تعليق `.env.example`).

## 15. مسار تعديل آمن + ترتيب قراءة مقترح

**عند التعديل:** (1) إن ناقض العمل وثيقة حاكمة، نقّح الوثيقة أولًا (`Documentation First`). (2) اكتب على فرع `feat/…`/`fix/…`. (3) شغّل البوابات الأربع بلا قاعدة بيانات + e2e إن مسّ السلوك. (4) إن تغيّر العقد، اتبع تدفّق القسم 7 (عقد الواجهة الأمامية ↔ الـ API). (5) commit ذرّي بصيغة Conventional Commits عبر PR ([الوثيقة 17](../eslammuatamed-docs/docs/17-git-workflow.md)).

**المفردات أوّلًا إن كان `NestJS` جديدًا عليك.** جدول «مفردات `NestJS`» في **صدر هذا الدليل**،
قبل القسم ١، هو الشرط المُسبَق للخطوة ٢ أدناه. **نسخة واحدة منه، في مكان واحد** — تكراره هنا كان
سيصير نسختين تفترقان عند أوّل تعديل، وهو العيب الذي أُصلح في القسم ١١ بالضبط.

**ترتيب القراءة للمطوّر الجديد.**

> **لا تقرأ الوحدات بترتيب اعتماديّاتها.** رسم الاعتماديّات يقول ما **يمكنك** قراءته، لا ما أنت
> **مستعدّ** له، والفرق بينهما ليس تفصيلًا: `contact` عمقها في الرسم **1** فقط (تعتمد على `mail`
> وحدها)، فالرسم يسمح بها ثانيًا — وهي من أصعب خمس وحدات في المستودع (مفاتيح `idempotency` +
> إرسال بعد الالتزام + مهمّة تطهير مجدولة). بينما `testimonials` عمقها **2** ولا تحمل فكرة واحدة
> خارج النموذج القانوني.
>
> **الترتيب أدناه يتدرّج في كثافة المفاهيم، ويفارق الرسم عمدًا حين يُقدِّم الرسمُ وحدةً من الحافة
> الصعبة.** قُل هذا صراحةً بدل «يحترم الاعتماديّات»، لأنّ الأخيرة **ليست صحيحة** هنا: `articles`
> و`projects` (الخطوة ٩) تستوردان `media`، وهي لا تُقرأ إلا في الخطوة ١٠. المفارقة مقصودة —
> `media` أثقل وحدة في المستودع، وتقديمها لأجل الرسم وحده يضع أصعب قراءة قبل أبسطها. وما تحتاجه
> فعلًا عن `media` عند قراءة `articles`/`projects` مذكور في §6.5: القراءة العامّة تُبقي `*Id`
> الخام وتُضيف بجانبه descriptor مُحلَّلًا. أمّا حيث تكون الاعتماديّة **مفهومًا** لا مجرّد حافة
> في الرسم — `mail` قبل `contact` — فهي مُدرَجة في مكانها أدناه.
>
> **والترتيب مسار تعلّم لا فهرسًا.** الفهرس الكامل للوحدات في
> [`src/modules/README.md`](src/modules/README.md)، وفيه ثلاث وحدات لا يمرّ بها هذا المسار:
> `testimonials` (لا فكرة خارج النموذج القانوني)، و`settings`/`seo` (صفّ مفرد singleton و`upsert`
> لكلّ مفتاح، مع تحليل لغة — فكرة حقيقيّة، لكن لا يتوقّف عليها فهم أيّ خطوة تالية). **المسار
> يرتّب الأفكار التي يبني بعضُها على بعض؛ ما لا يدخل في ذلك البناء يُقرأ عند الحاجة إليه، لا
> لإتمام قائمة.**

1. هذا الدليل (`PROJECT_GUIDE.md`) من أوّله — وجدول «مفردات `NestJS`» في صدره يسبق القسم ١، فإن قرأته من البداية فقد مررت به فعلًا.
2. [`src/config/README.md`](src/config/README.md) → [`src/prisma/README.md`](src/prisma/README.md) → [`src/common/README.md`](src/common/README.md) (البنية العرضية).
3. **[`src/modules/README.md`](src/modules/README.md) — إلزاميّ، وليس اختياريًّا.** وفيه تحديدًا قسم «أيّ طبقة ترفض أوّلًا» الذي يشرح لماذا تحصل على `422` هنا و`400` هناك بينما الـ `controller` لا يذكر أيًّا منهما. من دونه ستقرأ كل وحدة وأنت تفتقد نصف ما يجري فيها.
4. [`locales`](src/modules/locales/README.md) — **٧٦ سطر شيفرة (غير فارغة وغير تعليق؛ `wc -l` الخام يعطي ٩٠)، وتعتمد عليها عشر وحدات.** أصغر وحدة حقيقية وأكثر مقطع مشترك في المستودع؛ ستراها في كل `service` بعدها.
5. `health` — *لا `README` مخصّص لها عمدًا؛ وصفها في [النموذج القانوني](src/modules/README.md)* — أصغر وحدة كاملة: فحص حياة + فحص جاهزية يفتح الاتصال الكسول فعليًّا.
6. [`experiences`](src/modules/experiences/README.md) ثمّ [`skills`](src/modules/skills/README.md) — **النموذج القانوني وهو يعمل، بلا أيّ فكرة جديدة.** إن بدتا مكرّرتين فهذه هي الفائدة: التكرار هو النموذج.
7. [`taxonomy`](src/modules/taxonomy/README.md) — أكبر سطح مسارات في المستودع (٤ `controllers` / ١٠ مسارات) بأبسط منطق، وفيها أوّل مفهوم قاعديّ حقيقي: حذف تمنعه علاقة أجنبيّة (`P2003` → `409`).
8. [`redirects`](src/modules/redirects/README.md) — **١٤٧ سطر شيفرة (بالمقياس نفسه؛ `wc -l` الخام يعطي ١٩٥)، وأدقّ ممّا يوحي حجمها.** ولستَ تلقى `$transaction` هنا أوّل مرّة: رأيتَها في النموذج القانوني (الخطوة ٣، تدفّق الكتابة الإداريّة)، ثمّ في `experiences`/`skills` (٦) و`taxonomy` (٧) — وفي كلّها الـ `service` هو الذي يفتح المعاملة ويُغلقها. **الجديد هنا هو مِلكيّة حدود المعاملة، لا المعاملة نفسها:** `buildRedirectOps` **لا تُنفِّذ** شيئًا، بل تُعيد ثلاث عمليّات يدفعها **المُستدعي** في `$transaction` الخاصّ به، فتُلتزَم إعادةُ التسمية والتحويلُ ذرّيًّا معًا. أوّل درس في «مَن يملك حدود المعاملة» — وهو سؤال مختلف عن «ما المعاملة».
9. [`articles`](src/modules/articles/README.md) ثمّ [`projects`](src/modules/projects/README.md) — التركيب: جدولة نشر + بحث نصّي بـ `SQL` خام، ثمّ معاملة واحدة تجمع إعادة التسمية والتحويل والوسائط.
10. **الحافة الصعبة، أخيرًا وبهذا الترتيب:** [`media`](src/modules/media/README.md) → [`auth`](src/modules/auth/README.md) → [`access-control`](src/modules/access-control/README.md) → **[`mail`](src/modules/mail/README.md) →** [`contact`](src/modules/contact/README.md) → [`preview`](src/modules/preview/README.md). المفاهيم بالترتيب: خطّ معالجة وسائط بحدّ تزامن، تجزئة `argon2id` وتدوير `refresh`، صلاحيات تُحلّ من قاعدة البيانات مع ترتيب حرّاس عالميّ، ثمّ ناقل البريد، ثمّ `idempotency` وإرسال بعد الالتزام، وأخيرًا توقيع `HMAC` بنافذة صلاحية ومقارنة ثابتة الزمن. `preview` آخرًا لأنّها الأعمق في الرسم (عمق **3**).

    - **`mail` قبل `contact`، وهذا شرط مُسبَق حقيقيّ لا ترتيب مجاملة.** آلة الحالة في `contact`
      (`PENDING` → `SENT`/`FAILED`) غير مقروءة قبل ثلاث حقائق تعيش في `mail` وحدها: أنّ
      `MailService.send` **لا ترمي أبدًا** بل تُرجِع `MailSendResult`، وأنّ إعادة المحاولة
      **محدودة** (ثلاث محاولات ثمّ توقّف، ولا إعادة على رفض `5xx` دائم)، وأنّ المجموعة كلّها
      **اختياريّة ومعطَّلة افتراضيًّا** خلف `SMTP_ENABLED`. من دونها ستقرأ `FAILED` على أنّها
      استثناء مُلتقَط، و`PENDING` على أنّها عطل.
    - **`auth` يستورد `UsersModule`، ولا تحتاج قراءته أوّلًا:** `users` ٢٤ سطر شيفرة، بلا
      `controller` وبلا مسارات وبلا فكرة خارج النموذج القانوني — حافة في الرسم، لا مفهوم. وهذا
      بالضبط الفرق الذي تحذّر منه المقدّمة أعلاه: حافةُ استيراد ليست شرطًا تعليميًّا بذاتها.
11. [`test/README.md`](test/README.md) — بعد أن تعرف ما الذي يُختبَر.

## 16. روابط التوثيق الرسمي

- [NestJS](https://docs.nestjs.com) · [Prisma](https://www.prisma.io/docs) · [PostgreSQL 16](https://www.postgresql.org/docs/16/)
- [class-validator](https://github.com/typestack/class-validator) · [argon2 (node)](https://github.com/ranisalt/node-argon2) · [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [RFC 7807 Problem Details](https://datatracker.ietf.org/doc/html/rfc7807) · [OpenAPI Specification](https://spec.openapis.org/)
- الوثائق الحاكمة: [00](../eslammuatamed-docs/docs/00-engineering-principles.md) · [07](../eslammuatamed-docs/docs/07-backend-architecture.md) · [08](../eslammuatamed-docs/docs/08-folder-structure.md) · [09](../eslammuatamed-docs/docs/09-database-design.md) · [10](../eslammuatamed-docs/docs/10-api-design.md) · [16](../eslammuatamed-docs/docs/16-development-conventions.md) · [17](../eslammuatamed-docs/docs/17-git-workflow.md) · [19](../eslammuatamed-docs/docs/19-security.md) · [24](../eslammuatamed-docs/docs/24-roadmap.md)
