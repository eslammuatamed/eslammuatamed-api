# `src/prisma` — طبقة الوصول إلى البيانات

## المسؤولية

تقديم `PrismaService` **العام (`@Global`)** كـ data-mapper الوحيد لكل الوحدات. `Prisma` هنا هو التجريد نفسه — **لا طبقة repository** فوقه (`D07-2`).

## خريطة الملفّات

| الملف                  | الدور                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma.service.ts`    | `PrismaService extends PrismaClient` — يقرأ `DATABASE_URL` من `AppConfigService`، يبني مُحوِّل `PrismaPg`، اتصال كسول، يفصل الاتصال عند الإغلاق |
| `prisma.module.ts`     | `PrismaModule` — `@Global`؛ يوفّر ويُصدِّر `PrismaService`                                                                                      |
| `standalone-client.ts` | `createPrismaClient()` — عميل لما يعمل **خارج** `Nest` فقط (`seed`، سكربتات، اختبارات). داخل التطبيق: احقن `PrismaService`                      |

> ملاحظة: مخطّط قاعدة البيانات نفسه (`schema.prisma`, migrations, `seed.ts`) في مجلد `prisma/` بجذر المستودع، وموثّق في [الوثيقة 09 (Database Design)](../../../eslammuatamed-docs/docs/09-database-design.md) — لا نكرّره هنا.

## خريطة الاتصال

- **وارد:** كل `*.service.ts` تقريبًا يحقن `PrismaService` مباشرة.
- **صادر:** العميل المولَّد `src/generated/prisma` (`PrismaClient`) + `@prisma/adapter-pg` (`PrismaPg`) + `AppConfigService` (لقراءة الـ URL، لا `process.env`).

## المُشغِّل يحلّ المضيف الآن — لا محرّك `Rust` (`Prisma 7`)

مسار البيانات الكامل بعد الانتقال إلى `Prisma 7`:

```
Service → PrismaService → PrismaPg → node-postgres (pg) → PostgreSQL
```

`pg` يبقى تبعيّة **غير مباشرة** عبر المُحوِّل، ولا يُضاف قطّ كتبعيّة مباشرة.

**ما الذي تغيّر فعليًّا:** طبقة الاتصال صارت `JavaScript` بدل محرّك الاستعلام المكتوب بـ `Rust`.
ولذلك فإنّ **حلّ اسم المضيف، واختيار عائلة العناوين (`IPv4` مقابل `IPv6`)، وشكل أخطاء
الاتصال** كلّها الآن من مسؤولية `node-postgres`، لا `Prisma`. هذا سلوك مرئي من خارج التطبيق،
ولا يكفي اعتباره تفصيل تنفيذ.

> **نتيجة عملية مُلزِمة:** في الإنتاج يجب أن يكون مضيف `DATABASE_URL` هو `127.0.0.1` حرفيًّا،
> لا `localhost` (`D23-24`). قاعدة `trust` في `pg_hba.conf` مقصورة على `IPv4`، و`localhost`
> يُحلّ إلى `::1` أوّلًا فيقع على قاعدة `scram-sha-256` — والدور بلا كلمة مرور يقدّمها، فيفشل
> `SASL`. كان `Prisma 6` يُخفي هذا لأنّه يحلّ المضيف داخل محرّكه ويختار `IPv4`. التفاصيل في
> [الوثيقة 23 §3](../../../eslammuatamed-docs/docs/23-deployment.md) و[الوثيقة 19 §7b](../../../eslammuatamed-docs/docs/19-security.md).

## القرار المحوري: الاتصال الكسول (lazy)

```ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: AppConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.database.url,
        connectionTimeoutMillis: 5_000,
        idleTimeoutMillis: 300_000,
      }),
    });
  }
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

- **لا `onModuleInit` ولا `$connect` صريح عند الإقلاع.** مجمّع `pg` يفتح أول اتصال عند **أول استعلام**. لماذا هذا مهمّ؟ لأنه يتيح لـ `npm run contract:export` وللاختبارات إقلاع رسم `Nest` بالكامل **دون قاعدة بيانات** (`constitution rule 4`). وحدة `health` تُصدِر استعلامًا صريحًا (`SELECT 1`) لتثبت الجاهزية فعليًّا.
- **الإغلاق النظيف:** `onModuleDestroy` → `$disconnect`، ويُفعَّل عبر `app.enableShutdownHooks()` في `main.ts` عند `SIGTERM`/`SIGINT`.

## العقود والثوابت

- الـ URL يأتي من `AppConfigService`، لا من `process.env` مباشرة.
- وحدة لا تصل إلى نماذج `Prisma` لوحدة أخرى؛ التفاعل عبر خدمات مُصدَّرة (`D07-2`، [الوثيقة 08](../../../eslammuatamed-docs/docs/08-folder-structure.md)).

## مين بيفتح الاتصال مع PostgreSQL؟ (تغيّر في Prisma 7)

في `Prisma 6` كان `Prisma` نفسه يحمل محرّكًا يتكلّم مع `PostgreSQL`. في `Prisma 7` المحرّك اختفى:

```
service ← PrismaService ← PrismaClient (مولَّد) ← PrismaPg ← pg pool ← PostgreSQL
```

- **`PrismaClient` المولَّد** يترجم استعلاماتك إلى `SQL`. مكانه `src/generated/prisma`، وهو **كود مولَّد** — مُتجاهَل في `git` ويُعاد توليده بـ `npm run db:generate`. لا تعدّله.
- **`PrismaPg`** هو المُحوِّل (driver adapter): يملك مجمّع اتصالات `pg` ويُنفّذ الـ `SQL` فعليًّا. **هو** مَن يفتح الاتصال الآن.
- لذلك صار إعداد المجمّع مسؤوليتنا. اخترنا `connectionTimeoutMillis: 5000` و`idleTimeoutMillis: 300000` للحفاظ على سلوك `v6`؛ أمّا `max` فتُرك على قيمة `pg` الافتراضية (`10`). والسبب وراء كل قيمة مكتوب عند تعريفها في [`prisma.service.ts`](prisma.service.ts).

## `prisma.config.ts` مش إعدادات التطبيق

في جذر المستودع ملف `prisma.config.ts`. من السهل الخلط بينه وبين `AppConfigService`، والفرق بسيط: **مَن يقرأ كل واحد منهما.**

|          | `prisma.config.ts`                                                                          | `AppConfigService`                  |
| -------- | ------------------------------------------------------------------------------------------- | ----------------------------------- |
| يقرأه    | الـ **Prisma CLI** (`migrate`, `db seed`, `generate`, `studio`)                             | **التطبيق** وهو شغّال               |
| متى يعمل | في الطرفية أو في `CI`، قبل/خارج التطبيق                                                     | عند إقلاع `Nest` وبعده              |
| يحتوي    | مسار الـ `schema`، مسار الـ `migrations`، أمر الـ `seed`، والـ `URL` الذي يستخدمه الـ `CLI` | كل متغيّرات البيئة بعد التحقّق منها |

`PrismaService` **لا** يقرأ من `prisma.config.ts` — يأخذ الـ `URL` من `AppConfigService` كالمعتاد. السبب أن أمر `CLI` لا يملك حاوية `Nest` يسأل منها، فاحتاج ملفّه الخاص.

ملاحظتان عمليّتان:

- **الـ `seed` صار صريحًا.** في `Prisma 7` أمر `prisma migrate reset` **لم يعد** يشغّل الـ `seed` تلقائيًّا. لازم تشغّل `npm run db:seed` بنفسك بعده — وقبلها **`npm run build:ops`** مرّة واحدة، لأنّ أمر الـ `seed` صار يشغّل `JavaScript` مُصرَّفًا من `dist-ops/` لا `ts-node`.
- مكان أمر الـ `seed` واحد فقط: `migrations.seed` داخل `prisma.config.ts`. الحقل القديم `package.json#prisma` أُزيل حتى لا يوجد مصدران للحقيقة.

## نقطة تمديد آمنة: مقعد الاختبار (test seam)

بما أنه لا repository، فمقعد الاختبار هو **حقن `PrismaService` نفسه** عبر DI. الاختبارات تستبدله بـ mock (انظر `jest-mock-extended` في `*.service.spec.ts`)، فتُختبَر كل service وحدها دون قاعدة بيانات (`principle 13`).

## أخطاء شائعة

- إضافة `onModuleInit` مع `$connect` — يكسر ضمان «التصدير بلا قاعدة بيانات» (`constitution rule 4`).
- إنشاء `new PrismaClient()` في مكان آخر بدل حقن الخدمة العامّة. داخل التطبيق لا يوجد سبب مشروع لذلك؛ وخارجه (`seed`/سكربت/اختبار) استخدم `createPrismaClient()` ولا تكرّر إعداد المُحوِّل يدويًّا.
- وضع إعدادات الـ `CLI` في `AppConfigService` أو العكس — انظر القسم التالي.

## المرجع الرسمي وحالة التوافق

- [NestJS Prisma recipe](https://docs.nestjs.com/recipes/prisma) · [Prisma Client](https://www.prisma.io/docs/orm/prisma-client) · [Prisma connection management](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-management).

**حالة التوافق:**

- حقن `PrismaService` مباشرة في الـ services (بلا repository): **`Compatible`** — وصفة `NestJS` الرسمية لـ `Prisma` تفعل هذا حرفيًّا؛ والقرار مُوثّق في `D07-2`/`D00-3`. (المرجع الحاكم هنا هو `D07-2`، **لا** `principle 16`.)
- **الاتصال الكسول (بلا `$connect` عند الإقلاع):** `Compatible`. `Prisma` نفسه **يدعم الاتصال الكسول أصلًا** — استدعاء `$connect` اختياري، والعميل يفتح الاتصال كسولًا عند أول استعلام (توثيق `Prisma`). وهذا النمط **لا يخالف أي اتفاقية داخلية أو قاعدة دستورية**؛ بل يحقّق `constitution rule 4` (تصدير العقد بلا قاعدة بيانات) الذي يعتمد عليه المشروع صراحةً. فهو `Compatible` مع سلوك `Prisma` ومع اتفاقيات المشروع معًا — **لا انحراف**، ولا يستوجب إيقافًا. (ملاحظة: بعض أمثلة دمج `Prisma` مع `NestJS` تُظهِر `$connect` مُبكّرًا عبر `OnModuleInit`؛ إغفاله هنا خيار متوافق مع سلوك `Prisma` الافتراضي، لا مخالفة له.)
