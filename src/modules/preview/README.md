# `preview` — معاينة المسودّات (preview tokens)

> يتبع الشكل القانوني في [`src/modules/README.md`](../README.md). هنا ما يخصّها فقط.

## المسؤولية

سكّ رموز HMAC عديمة الحالة لمعاينة المسودّات (`D10-11`, `D19-7`) واستهلاكها. السطح الإداري: `POST /api/v1/admin/{articles,projects}/{id}/preview-token` (لكلّ نوع صلاحيّته: `articles.update` / `projects.update`) يُصدِر رمزًا مؤقّتًا (٣٠ دقيقة). السطح العام: `GET /api/v1/preview/{articles,projects}/{id}?token=&locale=` يُعيد المسودّة عند رمز صالح، ويُعيد **404** لأيّ رمز سيّئ/منتهٍ/مزوَّر/عبر-النوع/غائب (إخفاء المسودّة — `FR-PUB-046`، لا 401/403 أبدًا، بصيغة problem+json / RFC 7807).

## خريطة الملفّات

| الملف | الدور |
|---|---|
| `preview-token.service.ts` | `mint()`/`verify()` — HMAC عديم الحالة، `verify` لا يرمي أبدًا (`D19-7`) |
| `preview.admin.controller.ts` | سكّ الرمز (`@RequirePermission('articles.update')` / `('projects.update')`) — 200 + `no-store` |
| `preview.controller.ts` | استهلاك عام (`@Public`) — تحقّق الرمز ثمّ `getPreviewById` + `no-store` |
| `dto/preview-consume.query.dto.ts` · `entities/preview-token.entity.ts` | استعلام `?token&locale` + حمولة `{ token, url, expiresAt }` (داخل الغلاف المشترك) |

## خريطة الاتصال

- **يعتمد على:** `AppConfigService` (سرّ الرمز)، `ArticlesService`/`ProjectsService` المُصدَّرتين (فحص الوجود + `getPreviewById`).
- **يستورد:** `ArticlesModule`، `ProjectsModule`. لا دورة: `preview` → `articles`/`projects`، ولا عودة.

## ما يميّز هذه الوحدة عن النموذج

- **الرمز هو بوّابة الرؤية الوحيدة:** الاستهلاك يستدعي `verify(entityType, id, token)`؛ `false` ⇒ **404** (لا 401/403). رمز غائب ⇒ `''` ⇒ `verify` يرفض ⇒ 404 (لا 500). الحقل `token` في الـ DTO مُتساهل (`@IsOptional`, بلا `@MaxLength`) عمدًا كي لا يرفضه الأنبوب بـ 422 مميِّز.
- **محوران يجب ألّا يختلطا:** `entityType` مفرد (`article`/`project`) يربط الـ MAC ويطابق `verify`؛ ومقطع المسار جمع (`articles`/`projects`) يظهر في **رابط الواجهة المُصيَّر** (`url`) وأيضًا في مسار الاستهلاك العام لهذا الـ API — فكلاهما موجود فعلًا لرمز صالح.
- **`url` رابط واجهة مُطلق (`D10-11` v1.4.1 — الـ API يوقّع والواجهة تُصيّر):** `‎${PUBLIC_WEB_URL}/preview/{articles|projects}/{id}?token=…‎` — رابط مُطلق لصفحة الواجهة (**بلا** بادئة `/api/v1` و**بلا** `&locale=`)، تشاركه لوحة التحكّم حرفيًّا؛ ثمّ تُصيّر الواجهة المسودّة باستدعاء مسار الاستهلاك `‎GET /api/v1/preview/{articles|projects}/{id}?token=&locale=‎` في هذا الـ API. (كان هذا الحقل سابقًا مسارًا نسبيًّا للـ API؛ صُحِّح في `D10-11` v1.4.1 — استقلال المستودعات، قاعدة ١.) الرمز **لا يُسجَّل أبدًا** (مُقنَّع في سجلّات الطلبات) ولا يظهر في أيّ قراءة إدارية.
- **`getPreviewById` يتجاوز فلتر النشر:** يُعيد المسودّة/غير المنشور بالمعرّف مُعيدًا استخدام `resolveDetail()` نفسه (شكل لغة واحدة مُحلّى)؛ معرّف غائب فعلًا ⇒ 404.
- **200 لا 201:** لا يُنشأ مورد — يُشتقّ رمز عديم الحالة، مع `no-store`.

## العقود والثوابت

- تحقّق اللغة عبر `LocalesService.assertEnabled` داخل `getPreviewById` (لغة غير مُفعّلة → 400، لا رجوع صامت).
- `expiresAt` = وقت السكّ + ٣٠ دقيقة؛ الرمز يفشل مغلقًا عند الانتهاء بالضبط.
- رمز نوع مختلف (مقال على مسار المشاريع أو العكس) ⇒ 404 (الـ MAC يربط النوع).
- **بناء الرمز (`D19-7`):** النطاق المُوقَّع `entityType:entityId:exp` عبر `HMAC-SHA256`؛ الصيغة السلكيّة `base64url(exp).base64url(mac)`؛ عديم الحالة (لا تخزين ولا إبطال — الانتهاء يحدّ التسرّب)؛ و`verify` لا يرمي أبدًا (رمز مشوّه/طول خاطئ ⇒ `false` ⇒ 404، لا 500).
- **`PUBLIC_WEB_URL`** إعداد **مُخصَّص** (ليس مُشتقًّا من `CORS_ORIGIN`)، تُزال شرطته المائلة الأخيرة؛ افتراضه `http://localhost:3000` خارج الإنتاج، ومطلوب صراحةً في الإنتاج (وإلّا يفشل الإقلاع). سرّ التوقيع `PREVIEW_TOKEN_SECRET` يُقرأ فقط عبر `AppConfigService` (لا `process.env` مباشرة).

## القيود المقبولة والمؤجَّل

- **صفحة المعاينة المُصيَّرة على الواجهة:** هذا الـ API يوقّع الرمز ويُعيد بيانات المسودّة (JSON) فقط؛ تصيير صفحة `‎/preview/{type}/{id}‎` مسؤوليّة `eslammuatamed-web` (`D10-11` v1.4.1، استقلال المستودعات — قاعدة ١). لا كود/عقود مُشتركة عبر المستودعين سوى وثيقة OpenAPI المُصدَّرة.

## الاختبارات

`preview-token.service.spec.ts` (round-trip/انتهاء/تزوير/قمامة) · `preview.controller.spec.ts` (استهلاك: مسودّة صالحة، وكلّ رمز سيّئ + عبر-النوع ⇒ 404) · `preview.admin.controller.spec.ts` (سكّ: الشكل + الـ `url` + الأذونات + 200/no-store + فحص الوجود) · `getPreviewById` في specs المقالات/المشاريع + `test/preview.e2e-spec.ts`.

## المرجع الرسمي وحالة التوافق

- [Node `crypto` — `createHmac` + `timingSafeEqual`](https://nodejs.org/api/crypto.html).
- [NestJS — Headers & HTTP status code](https://docs.nestjs.com/controllers).

**حالة التوافق:** `Compatible`. **لا انحراف.**
