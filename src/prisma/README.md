# `src/prisma` — طبقة الوصول إلى البيانات

## المسؤولية

تقديم `PrismaService` **العام (`@Global`)** كـ data-mapper الوحيد لكل الوحدات. `Prisma` هنا هو التجريد نفسه — **لا طبقة repository** فوقه (`D07-2`).

## خريطة الملفّات

| الملف | الدور |
|---|---|
| `prisma.service.ts` | `PrismaService extends PrismaClient` — يقرأ `DATABASE_URL` من `AppConfigService`، اتصال كسول، يفصل الاتصال عند الإغلاق |
| `prisma.module.ts` | `PrismaModule` — `@Global`؛ يوفّر ويُصدِّر `PrismaService` |

> ملاحظة: مخطّط قاعدة البيانات نفسه (`schema.prisma`, migrations, `seed.ts`) في مجلد `prisma/` بجذر المستودع، وموثّق في [الوثيقة 09 (Database Design)](../../../eslammuatamed-docs/docs/09-database-design.md) — لا نكرّره هنا.

## خريطة الاتصال

- **وارد:** كل `*.service.ts` تقريبًا يحقن `PrismaService` مباشرة.
- **صادر:** `@prisma/client` (`PrismaClient`) + `AppConfigService` (لقراءة الـ URL، لا `process.env`).

## القرار المحوري: الاتصال الكسول (lazy)

```ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: AppConfigService) {
    super({ datasourceUrl: config.database.url });
  }
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

- **لا `onModuleInit` ولا `$connect` صريح عند الإقلاع.** `Prisma` يفتح المجمّع (pool) عند **أول استعلام**. لماذا هذا مهمّ؟ لأنه يتيح لـ `npm run contract:export` وللاختبارات إقلاع رسم `Nest` بالكامل **دون قاعدة بيانات** (`constitution rule 4`). وحدة `health` تُصدِر استعلامًا صريحًا (`SELECT 1`) لتثبت الجاهزية فعليًّا.
- **الإغلاق النظيف:** `onModuleDestroy` → `$disconnect`، ويُفعَّل عبر `app.enableShutdownHooks()` في `main.ts` عند `SIGTERM`/`SIGINT`.

## العقود والثوابت

- الـ URL يأتي من `AppConfigService`، لا من `process.env` مباشرة.
- وحدة لا تصل إلى نماذج `Prisma` لوحدة أخرى؛ التفاعل عبر خدمات مُصدَّرة (`D07-2`، [الوثيقة 08](../../../eslammuatamed-docs/docs/08-folder-structure.md)).

## نقطة تمديد آمنة: مقعد الاختبار (test seam)

بما أنه لا repository، فمقعد الاختبار هو **حقن `PrismaService` نفسه** عبر DI. الاختبارات تستبدله بـ mock (انظر `jest-mock-extended` في `*.service.spec.ts`)، فتُختبَر كل service وحدها دون قاعدة بيانات (`principle 13`).

## أخطاء شائعة

- إضافة `onModuleInit` مع `$connect` — يكسر ضمان «التصدير بلا قاعدة بيانات» (`constitution rule 4`).
- إنشاء `new PrismaClient()` في مكان آخر بدل حقن الخدمة العامّة.

## المرجع الرسمي وحالة التوافق

- [NestJS Prisma recipe](https://docs.nestjs.com/recipes/prisma) · [Prisma Client](https://www.prisma.io/docs/orm/prisma-client) · [Prisma connection management](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-management).

**حالة التوافق:**
- حقن `PrismaService` مباشرة في الـ services (بلا repository): **`Compatible`** — وصفة `NestJS` الرسمية لـ `Prisma` تفعل هذا حرفيًّا؛ والقرار مُوثّق في `D07-2`/`D00-3`. (المرجع الحاكم هنا هو `D07-2`، **لا** `principle 16`.)
- **حذف `$connect` المُبكّر (الاتصال الكسول):** الاتصال الكسول نفسه **متّسق مع إرشاد `Prisma` الرسمي** بأن `$connect` اختياري وأن العميل يتّصل كسولًا عند أول استعلام (بهذا المعنى هو `Compatible` مع سلوك `Prisma`). إضافةً لذلك، الحذف المتعمّد لاستدعاء `$connect` المُبكّر — النمط الشائع في بعض أمثلة دمج `Prisma` مع `NestJS` — هو **اختيار مقصود موثّق (`Intentional documented deviation`)** مبرَّره `constitution rule 4` (تصدير العقد بلا قاعدة بيانات)، **لا** `principle 16`. انحراف **مُفسَّر**، لا يستوجب إيقافًا. (ملاحظة: وصفة `NestJS` الرسمية لـ `Prisma` تطوّرت وقد لا تُظهِر `$connect` مُبكّرًا في نسختها الحالية؛ فالانحراف عن *النمط المُبكّر* لا عن الوصفة الحالية حرفيًّا.)
