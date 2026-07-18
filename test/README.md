# `test/` — اختبارات النهاية-إلى-النهاية (e2e)

## المسؤولية

اختبارات e2e التي تُقلِع التطبيق الكامل ضدّ `PostgreSQL` حقيقي وتؤكّد السلوك **ومطابقة العقد**. اختبارات الوحدة تعيش **بجوار مصادرها** (`*.spec.ts` داخل `src/`، `D08-3`)، لا هنا.

## خريطة الملفّات

| الملف/المجلد | الدور |
|---|---|
| `jest-e2e.json` | إعداد `jest` لمسار الـ e2e (منفصل عن إعداد الوحدة في `package.json`) |
| `utils/e2e-app.ts` | تهيئة تطبيق `Nest` كامل للاختبار (نفس الـ pipes/filters/guards) |
| `utils/contract.ts` | تحميل `openapi.json` لتأكيدات `jest-openapi` |
| `<domain>.e2e-spec.ts` | مجموعة لكل مجال: `auth`, `articles`, `articles-related`, `projects`, `settings`, `experiences`, `skills`, `testimonials`, `access-control`, `list-envelopes`, `health` |

## ما تُثبته الاختبارات

- **مطابقة العقد:** `jest-openapi` يؤكّد أن كل استجابة (نجاح **وخطأ**) تطابق مخطّط `openapi.json` — فلا ينحرف التنفيذ عن العقد بصمت.
- **السلوك عبر الحرّاس الحقيقيين:** الدخول/التجديد/الخروج، default-deny، إنفاذ الصلاحيات، إخفاء المسودّات (404)، أغلفة القوائم، تحليل اللغة.

## كيف تُشغَّل (تحتاج Postgres)

```bash
export DATABASE_URL=postgresql://eslammuatamed@localhost:5432/eslammuatamed_test
npx prisma migrate deploy && npm run db:seed
npm run test:e2e            # --runInBand
```
الـ CI يشغّلها في مسار `e2e` بخدمة `postgres:16` (انظر `.github/workflows/ci.yml`).

## العلاقة بالوثيقة الحاكمة

استراتيجية الاختبار الكاملة (الطبقات، ما يُختبَر عند كل مستوى، تأكيدات العقد) في [الوثيقة 18 (Testing Strategy)](../../eslammuatamed-docs/docs/18-testing-strategy.md) — لا نكرّرها هنا.

## أخطاء شائعة

- وضع اختبارات وحدة هنا بدل جوار المصدر (`D08-3`).
- تشغيل e2e دون `migrate`/`seed` مسبقين.

## المرجع الرسمي وحالة التوافق

- [NestJS Testing (e2e)](https://docs.nestjs.com/fundamentals/testing#end-to-end-testing) · [Supertest](https://github.com/ladjs/supertest) · [jest-openapi](https://github.com/openapi-library/OpenAPIValidators/tree/master/packages/jest-openapi).

**حالة التوافق:** `Compatible`. اختبار e2e بـ `Supertest` على تطبيق `Nest` كامل هو النمط الرسمي؛ وتأكيد العقد بـ `jest-openapi` امتداد يخدم `principle 3`. **لا انحراف.**
