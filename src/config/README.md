# `src/config` — الإعداد المُتحقَّق منه عند الإقلاع

## المسؤولية

الباب الوحيد المُنمَّط (typed) للإعدادات. **لا كود خارج هذه الوحدة يقرأ `process.env`** (`constitution rule 5`، [الوثيقة 07 §3](../../../eslammuatamed-docs/docs/07-backend-architecture.md)). البيئة تُتحقَّق **عند الإقلاع**: قيمة مفقودة أو غير صالحة تُفشِل تشغيل العملية فورًا (fail fast) بدل أن تظهر كخطأ 500 وقت الطلب.

## خريطة الملفّات

| الملف | الدور |
|---|---|
| `env.validation.ts` | صنف `EnvironmentVariables` بـ decorators من `class-validator` + دالّة `validate()` + الـ enums (`NodeEnv`, `StorageDriver`) |
| `app-config.service.ts` | `AppConfigService`: getters مُنمَّطة ومُجمَّعة (`auth`, `database`, `storage`, `seed`…) |
| `config.module.ts` | `AppConfigModule` — `@Global`، يمرّر `validate` إلى `ConfigModule.forRoot` |
| `env.validation.spec.ts` | اختبارات وحدة للتحقّق (قبول/رفض) |

## خريطة الاتصال

- **وارد:** أي وحدة تحقن `AppConfigService` (وهو `@Global`، فلا حاجة لإعادة استيراد الوحدة). أمثلة: `PrismaService` (يقرأ `database.url`)، `AuthModule` (يقرأ `auth.*`)، `main.ts` (يقرأ `port`, `corsOrigin`, `isProduction`).
- **صادر:** `ConfigModule` من `@nestjs/config` فقط.

## تدفّق التشغيل

```
الإقلاع → ConfigModule.forRoot({ validate }) → validate(process.env)
   ├─ plainToInstance(EnvironmentVariables, raw)   // coercion (PORT → number)
   ├─ validateSync(...)                            // class-validator
   └─ errors.length > 0 ? throw  :  return instance
```

الصنف `ConfigService<EnvironmentVariables, true>` (المعامل `true` = «تم التحقّق») يجعل الـ getters لا تُرجِع `undefined` لمفتاح مطلوب. مثال:

```ts
get isProduction(): boolean { return this.nodeEnv === NodeEnv.Production; }
```

## العقود والثوابت (invariants)

- كل متغيّر مطلوب له قاعدة تحقّق صريحة (طول أدنى للأسرار، نطاق للمنافذ، صيغة مدّة لـ `JWT_ACCESS_TTL` عبر `@Matches(/^\d+(ms|s|m|h|d)$/)`).
- **`DATABASE_URL` له قاعدة صيغة صريحة (`D16-12`):** سلسلة اتصال `postgresql://`/`postgres://` بلا مسافات — فقيمة مشوَّهة تُرفَض عند الإقلاع بدل أن تظهر كخطأ اتصال غامض لاحقًا.

  > **حدّ هذا التحقّق، مذكورًا صراحةً:** القاعدة تتحقّق من **الصيغة**، لا من أنّ المضيف
  > يُحلّ إلى العنوان الصحيح. وبتاريخ `2026-08-14` كانت قيمة `DATABASE_URL` في الإنتاج
  > **صحيحة الصيغة تمامًا**، واجتازت التحقّق عند الإقلاع، ووصلت إلى المُحوِّل سليمة — ومع ذلك
  > سقط الإنتاج، لأنّ `localhost` يُحلّ إلى `::1` بينما قاعدة `trust` مقصورة على `IPv4`
  > (`D23-24`). لا يمكن لتحقّقٍ من الصيغة أن يلتقط هذا الصنف من الأعطال، والاعتماد عليه
  > بوصفه ضمانًا هو الخطأ. الضمان الفعلي هو **بوابة النشر** التي تنفّذ استعلامًا حقيقيًّا
  > (`readiness` + نقاط دخان، `D23-23`).
- `COOKIE_DOMAIN` اختياري؛ سلسلة فارغة تُطبَّع إلى `undefined` (كوكي host-only، صحيح لـ localhost).
- **الأسرار لا تدخل git ولا السجلّات** (تنقيح pino — `D07-5`).

## نطاق المخطّط اليوم

الوحدات التي كان هذا القسم يصفها `Planned` صارت **مُسلَّمة**: `media` (الميزة 003) و`preview`. والمخطّط
اليوم يتحقّق من `STORAGE_DRIVER`, `STORAGE_LOCAL_DIR`, `PUBLIC_MEDIA_URL`, `PREVIEW_TOKEN_SECRET`،
**ومن `S3_*`** (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, و`S3_REGION`
الاختياري) التي دخلت مع الميزة 003، **ومن `SMTP_*`** و`CONTACT_NOTIFICATION_TO` لمسار البريد.

> المبدأ الذي كان يبرّر الوضع القديم ما زال قائمًا: **الإعداد يسبق الوحدة عمدًا** — يُتحقَّق من المتغيّر
> عند الإقلاع قبل أن توجد الوحدة التي تستهلكه، فلا تُكتشَف بيئة ناقصة وقت أول طلب.

## الاختبارات وما تُثبته

`env.validation.spec.ts`: بيئة صالحة تمرّ، وبيئة ناقصة/خاطئة تُرمى برسالة مقروءة. هذا يثبت ضمان «الفشل عند الإقلاع».

## وصفة تعديل شائعة: إضافة متغيّر بيئة جديد

1. أضِف الحقل في `EnvironmentVariables` مع decorator التحقّق المناسب.
2. أضِف getter مُنمَّطًا في `AppConfigService` (لا تقرأ `process.env` في أي مكان آخر).
3. أضِف سطره في `.env.example` (عقد الإعداد — تغيير ناقص بلا هذا السطر = غير مكتمل، [الوثيقة 16 §1](../../../eslammuatamed-docs/docs/16-development-conventions.md)).
4. حدِّث بيئة الـ e2e في `.github/workflows/ci.yml` إن كان المتغيّر مطلوبًا هناك.

## أخطاء شائعة

- قراءة `process.env` مباشرة في أي مكان آخر — انتهاك `constitution rule 5`.
- إضافة متغيّر دون سطر `.env.example` ودون قاعدة تحقّق.

## المرجع الرسمي وحالة التوافق

- [NestJS Configuration](https://docs.nestjs.com/techniques/configuration) — استخدام دالّة `validate` مخصّصة والـ generic `WasValidated`.
- [class-validator](https://github.com/typestack/class-validator) · [class-transformer](https://github.com/typestack/class-transformer).

**حالة التوافق:** `Compatible`. النمط (مخطّط بيئة بـ class-validator يُمرَّر إلى `ConfigModule.forRoot({ validate })`، وخدمة إعداد مُنمَّطة تُخفي `process.env`) هو ما يوصي به توثيق `NestJS` الحالي حرفيًّا.
