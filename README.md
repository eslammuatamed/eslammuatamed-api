# eslammuatamed-api

خدمة REST بـ `NestJS 11` + `Prisma 7` + `PostgreSQL 16` لمنصّة `eslammuatamed`.

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
# لا تُنشئ قاعدة اختبار ثابتة: حزمة e2e تُنشئ قاعدتها وتُسقطها بنفسها (D18-8) — انظر قسم e2e أدناه.

npx prisma migrate deploy     # تطبيق الـ migration المُلتزَم على قاعدة dev
npm run build:ops             # مطلوب قبل db:seed — يبني البذرة المُصرَّفة في dist-ops/
npm run db:seed               # locales، دور OWNER (+ منحة '*')، المالك، الإعدادات، التصنيفات
npm run start:dev             # http://localhost:3001  (Swagger UI على /docs)
```

> **لماذا `build:ops` أولًا؟** `db:seed` و`content:sync:*` تعمل الآن من `JavaScript` **مُصرَّف** في
> `dist-ops/` بدل `ts-node`، لأنّ إصدار الإنتاج المُقلَّم (`npm prune --omit=dev`) لا يحوي `ts-node`
> ولا مجلّد `src/`. لم نربط البناء داخل السكربتات نفسها لأنّ `tsc` غير موجود في
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

## اختبارات e2e (تحتاج خادم Postgres يعمل)

**لا تُهيّئ قاعدة بيانات يدويًّا، ولا تُصدِّر `DATABASE_URL` لقاعدة اختبار.** الحزمة **تملك قاعدتها**
(`D18-8`/`D18-9`): في كل تشغيل تُولّد اسمًا فريدًا `eslammuatamed_e2e_<run-id>`، تُنشئه وتُرحّله وتبذره،
ثم تُسقطه في النهاية.

```bash
npm run test:e2e              # Supertest + jest-openapi — يبني dist-ops تلقائيًّا
```

> **ليه مفيش خطوة `migrate`/`seed` يدويّة؟** لأنّ للتهيئة **مالكًا واحدًا** هو الحزمة نفسها؛ مالكان
> متنافسان يُخفيان أيّهما فعل ماذا.
>
> **وليه ده آمن مع `.env` تطويريّ؟** من `DATABASE_URL` المُهيَّأ تُؤخَذ **بيانات الخادم فقط** (المضيف،
> المنفذ، الاعتماد) ويُهمَل اسم قاعدته، فلا يمكن لتشغيل e2e أن يكتب في `eslammuatamed_dev`. وحارس
> `fail-closed` في `test/utils/e2e-setup.ts` يرفض إقلاع التطبيق أصلًا إن لم تُشِر `DATABASE_URL` إلى قاعدة
> وَلَّدَتْها هذه الجولة. التفاصيل في [`test/README.md`](test/README.md).

في الـ CI يعمل المسار نفسه بخدمة `Postgres 16`، بلا خطوات ترحيل أو بذر مقابلة — المحلّي والـ CI يستعملان الحزمة نفسها المالكة لقاعدتها. خطوات مسار `e2e` بتفصيلها يملكها [`PROJECT_GUIDE.md` §11](PROJECT_GUIDE.md) — **لا تُكرَّر هنا**.

## النشر

**لا أوسمة (`tags`).** وصول commit إلى `main` — دفعًا أو دمجَ ترقية `dev → main` — يُشغّل `deploy.yml` على ذلك الـ `SHA` بعينه. وقد يُشغَّل **تشغيلان** لنفس الـ `SHA`: دفعة `main`، ويُضاف إليها احتياطيّ `deploy-fallback.yml` عند دمج PR (لأنّ حدث الدفع يسقط أحيانًا) فيُرسِل نفس الخطّ بـ `workflow_dispatch`. مجموعة التزامن الواحدة و`preflight` تجعلان الزوج مُتماثلًا (idempotent): **تشغيل واحد على الأكثر يبلغ الكتابة على الخادم**.

ووظيفة التحويل هي **الوحيدة** التي تكتب على الخادم، وهي مربوطة ببيئة `production` في `GitHub`. أمّا وقوفها لموافقة المالك فمصدره قاعدة المراجِع المطلوب المضبوطة على تلك البيئة (`D23-16`, `D23-17`) — **إعداد خارج ملفّات سير العمل**، فلا تستنتجه من الـ `YAML` وحده. النشر على `Contabo VPS` بلا `Docker`.

الآليّة بتفصيلها يملكها [`PROJECT_GUIDE.md` §11](PROJECT_GUIDE.md) و[الوثيقة 23 (Deployment)](../eslammuatamed-docs/docs/23-deployment.md) — **لا تُكرَّر هنا**، فنسختان من وصف خطّ النشر تفترقان عند أوّل تغيير. للمرجع: [التوثيق الرسمي لنشر NestJS](https://docs.nestjs.com/deployment).

## انضباط التغيير

Doc-first: عمل يناقض وثيقة معتمدة ← نقّح الوثيقة في `../eslammuatamed-docs` أولًا (سجلّ قرار + رفع إصدار). Conventional Commits عبر PR. تغييرات العقد تتبع [الوثيقة 16 §3](../eslammuatamed-docs/docs/16-development-conventions.md) (تصدير → إصدار → يتبنّاه web).

## الترخيص

`UNLICENSED` — مستودع خاص.
