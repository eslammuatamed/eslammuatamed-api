# `preview` — معاينة المسودّات (preview tokens)

> يتبع الشكل القانوني في [`src/modules/README.md`](../README.md). هنا ما يخصّها فقط.

## المسؤولية

سكّ رموز HMAC عديمة الحالة لمعاينة المسودّات (`D10-11`, `D19-7`) واستهلاكها. السطح الإداري: `POST /admin/{articles,projects}/{id}/preview-token` يُصدِر رمزًا مؤقّتًا (٣٠ دقيقة). السطح العام: `GET /preview/{articles,projects}/{id}?token=&locale=` يُعيد المسودّة عند رمز صالح، ويُعيد **404** لأيّ رمز سيّئ/منتهٍ/مزوَّر/غائب (إخفاء المسودّة — `FR-PUB-046`، لا 401/403 أبدًا).

## خريطة الملفّات

| الملف | الدور |
|---|---|
| `preview-token.service.ts` | `mint()`/`verify()` — HMAC عديم الحالة، `verify` لا يرمي أبدًا (`D19-7`) |
| `preview.admin.controller.ts` | سكّ الرمز (`@RequirePermission` لكلّ نوع) — 200 + `no-store` |
| `preview.controller.ts` | استهلاك عام (`@Public`) — تحقّق الرمز ثمّ `getPreviewById` + `no-store` |
| `dto/preview-consume.query.dto.ts` · `entities/preview-token.entity.ts` | استعلام `?token&locale` + ردّ `{ token, url, expiresAt }` |

## خريطة الاتصال

- **يعتمد على:** `AppConfigService` (سرّ الرمز)، `ArticlesService`/`ProjectsService` المُصدَّرتين (فحص الوجود + `getPreviewById`).
- **يستورد:** `ArticlesModule`، `ProjectsModule`. لا دورة: `preview` → `articles`/`projects`، ولا عودة.

## ما يميّز هذه الوحدة عن النموذج

- **الرمز هو بوّابة الرؤية الوحيدة:** الاستهلاك يستدعي `verify(entityType, id, token)`؛ `false` ⇒ **404** (لا 401/403). رمز غائب ⇒ `''` ⇒ `verify` يرفض ⇒ 404 (لا 500). الحقل `token` في الـ DTO مُتساهل (`@IsOptional`, بلا `@MaxLength`) عمدًا كي لا يرفضه الأنبوب بـ 422 مميِّز.
- **محوران يجب ألّا يختلطا:** `entityType` مفرد (`article`/`project`) يربط الـ MAC ويطابق `verify`؛ ومقطع المسار جمع (`articles`/`projects`) يطابق مسار الاستهلاك العام — فالـ `url` الذي يشير إليه رمز صالح يوجد فعلًا.
- **`url` نسبيّ للـ API (`D10-11`):** `‎/api/v1/preview/{articles|projects}/{id}?token=…‎` — مسار الاستهلاك في هذا الـ API، **لا** صفحة معاينة على الواجهة (استقلال المستودعات، قاعدة ١). الرمز **لا يُسجَّل أبدًا** ولا يظهر في أيّ قراءة إدارية.
- **`getPreviewById` يتجاوز فلتر النشر:** يُعيد المسودّة/غير المنشور بالمعرّف مُعيدًا استخدام `resolveDetail()` نفسه (شكل لغة واحدة مُحلّى)؛ معرّف غائب فعلًا ⇒ 404.
- **200 لا 201:** لا يُنشأ مورد — يُشتقّ رمز عديم الحالة، مع `no-store`.

## العقود والثوابت

- تحقّق اللغة عبر `LocalesService.assertEnabled` داخل `getPreviewById` (لغة غير مُفعّلة → 400، لا رجوع صامت).
- `expiresAt` = وقت السكّ + ٣٠ دقيقة؛ الرمز يفشل مغلقًا عند الانتهاء بالضبط.
- رمز نوع مختلف (مقال على مسار المشاريع أو العكس) ⇒ 404 (الـ MAC يربط النوع).

## الاختبارات

`preview-token.service.spec.ts` (round-trip/انتهاء/تزوير/قمامة) · `preview.controller.spec.ts` (استهلاك: مسودّة صالحة، وكلّ رمز سيّئ + عبر-النوع ⇒ 404) · `preview.admin.controller.spec.ts` (سكّ: الشكل + الـ `url` + الأذونات + 200/no-store + فحص الوجود) · `getPreviewById` في specs المقالات/المشاريع + `test/preview.e2e-spec.ts`.

## المرجع الرسمي وحالة التوافق

- [Node `crypto` — `createHmac` + `timingSafeEqual`](https://nodejs.org/api/crypto.html).
- [NestJS — Headers & HTTP status code](https://docs.nestjs.com/controllers).

**حالة التوافق:** `Compatible`. **لا انحراف.**
