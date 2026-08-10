# eslammuatamed-api

خدمة REST بـ `NestJS 11` + `Prisma 6` + `PostgreSQL 16` لمنصّة `eslammuatamed`.

هذا الملف مرجع تشغيل سريع فقط. **لفهم المعمارية والتدفّقات ومراجعة التوافق ابدأ من [`PROJECT_GUIDE.md`](PROJECT_GUIDE.md)**، ثم ملفات `README.md` داخل مجلدات `src/`.

الوثائق الحاكمة (مصدر الحقيقة المعماري) في `../eslammuatamed-docs/docs/` — خاصّةً `00` (الدستور) و`07`/`09`/`10`/`19` (معمارية هذا المستودع). ملزِم أيضًا: `.specify/memory/constitution.md`.

## المتطلّبات

- `Node 24` (مثبّت في `.nvmrc`).
- `PostgreSQL 16` أصلي على المنفذ `5432`. **لا `Docker` في المشروع** (توجيه المالك، `D16-5`) — هيّئ `Postgres` أصليًّا.

## التشغيل السريع

```bash
npm ci
cp .env.example .env          # مُتحقَّق منه عند الإقلاع؛ املأ القيم المحلّية

# قواعد البيانات المحلّية (Postgres أصلي، دور eslammuatamed بلا كلمة مرور):
createuser eslammuatamed
createdb -O eslammuatamed eslammuatamed_dev
createdb -O eslammuatamed eslammuatamed_test

npx prisma migrate deploy     # تطبيق الـ migration المُلتزَم على قاعدة dev
npm run build:ops             # مطلوب قبل db:seed — يبني البذرة المُصرَّفة في dist-ops/
npm run db:seed               # locales، دور OWNER (+ منحة '*')، المالك، الإعدادات، التصنيفات
npm run start:dev             # http://localhost:3001  (Swagger UI على /docs)
```

> **لماذا `build:ops` أولًا؟** `db:seed` و`content:sync:*` تعمل الآن من `JavaScript` **مُصرَّف** في
> `dist-ops/` بدل `ts-node`، لأنّ إصدار الإنتاج المُقلَّم (`npm prune --omit=dev`) لا يحوي `ts-node`
> ولا مجلّد `src/` (‏`F9-13`/`F9-14`). لم نربط البناء داخل السكربتات نفسها لأنّ `tsc` غير موجود في
> الإنتاج، فربطُه كان سيكسر الأمر حيث يهمّ فعلًا. `npm run build` الكامل يبنيه أيضًا.

> ملاحظة إعداد: الدور بلا كلمة مرور قد يُفشِل أول `migrate deploy`/`db:seed` لأن `pg_hba.conf` الافتراضي يطلب `scram-sha-256` على `127.0.0.1`؛ أضِف سطر `trust` مُقيَّدًا على loopback (انظر تعليق `.env.example` و`runbooks/setup.md` في `../eslammuatamed-docs`).

## البوابات (بلا قاعدة بيانات)

الاتصال بـ `Postgres` كسول (lazy)، فتعمل هذه كلها دون قاعدة بيانات:

```bash
npm run lint
npx tsc --noEmit
npm test                      # اختبارات الوحدة
npm run contract:export       # → openapi.json (العقد الرسمي)
```

## اختبارات e2e (تحتاج Postgres)

تعمل ضدّ قاعدة **الاختبار** — هيّئها (migrate ثم seed) ثم شغّلها ببيانات اعتماد متّسقة مع الـ seed:

```bash
export DATABASE_URL=postgresql://eslammuatamed@localhost:5432/eslammuatamed_test
export SEED_OWNER_EMAIL=owner@example.com
export SEED_OWNER_PASSWORD=change-me-minimum-12

npx prisma migrate deploy     # أول مرّة / بعد تغيير المخطّط
npm run build:ops             # مطلوب قبل db:seed
npm run db:seed               # idempotent
npm run test:e2e              # Supertest + jest-openapi — يبني dist-ops تلقائيًّا
```

في الـ CI: مسار `e2e` في `.github/workflows/ci.yml` يشغّل خدمة `Postgres 16` ثم `npm ci` → `generate` → `test:e2e` فقط. **لا يوجد فيه `migrate deploy` ولا `db:seed`** — فمنذ `D18-8` يملك مِعمار الاختبارات قاعدةً خاصّة به لكلّ تشغيل: ينشئها ويُرحّلها ويبذرها ويُسقطها بنفسه، فلا يوجد سوى مالكٍ واحد للتهيئة. الخطوات اليدوية أعلاه هي للتشغيل المحلّي على قاعدة ثابتة.

## النشر

الوسم `vX.Y.Z` على `main` يُشغّل البناء والنشر ويُرفِق `openapi.json` كأثر إصدار. النشر على `Contabo VPS` بلا `Docker`. التفاصيل في [الوثيقة 23 (Deployment)](../eslammuatamed-docs/docs/23-deployment.md) و[التوثيق الرسمي لنشر NestJS](https://docs.nestjs.com/deployment).

## انضباط التغيير

Doc-first: عمل يناقض وثيقة معتمدة ← نقّح الوثيقة في `../eslammuatamed-docs` أولًا (سجلّ قرار + رفع إصدار). Conventional Commits عبر PR. تغييرات العقد تتبع [الوثيقة 16 §3](../eslammuatamed-docs/docs/16-development-conventions.md) (تصدير → إصدار → يتبنّاه web).

## الترخيص

`UNLICENSED` — مستودع خاص.
