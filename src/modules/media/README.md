# `media` — مكتبة الوسائط المركزية

> اقرأ [`src/modules/README.md`](../README.md) أولًا. هذه الوحدة هي **مكتبة الوسائط المركزية القابلة لإعادة الاستخدام** (`D02-7`): كل وحدات المحتوى (`projects`, `articles`, `testimonials`, `settings`) تشير إلى أصولها بالمرجع فقط، ولا ترفع أو تعالج الوسائط بنفسها.

## المسؤولية

رفع الصور وملف السيرة الذاتية `PDF`، مع إزالة التكرار بـ `SHA-256`، ومعالجة الصور إلى `master` وبدائل (`variants`) بصيغ `WebP`/`AVIF`، وتخزينها خلف `StorageAdapter` واحد، وخدمتها مباشرةً من أصل الوسائط.

## خريطة الملفّات

| الملف                                                                  | الدور                                                                                                               |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `media.admin.controller.ts`                                            | مسارات محروسة تحت `/admin/media` (كل نقطة تُعلن `media.*`)؛ حدّ الرفع + حالة `201/200` الديناميكية                  |
| `media.service.ts`                                                     | التنسيق: إزالة التكرار، الترقيم (`persistImage`/`persistPdf`)، `usages`، الحذف الآمن (`D07-7`: الصفّ أوّلًا)، تعويض الرفع `D07-6`                 |
| `media-processing.service.ts`                                          | خطّ `Sharp`: تعقيم الأصل → `master` → البدائل ضمن الميزانية → `BlurHash`                                            |
| `media-processing.util.ts`                                             | منطق قابل للاختبار بلا `Sharp`: سُلّم الجودة، التحقّق من الامتداد، والتحقّق البنيوي للـ `PDF`                       |
| `media-descriptor.resolver.ts` · `entities/media-descriptor.entity.ts` | حلّ الواصفات (`descriptors`) العامّة المُضافة على قراءات الوحدات الأخرى                                             |
| `processing-concurrency.limiter.ts` · `retry-after.interceptor.ts`     | سقف المعالجة المتزامنة `2`، و`429` + `Retry-After`                                                                  |
| `storage/`                                                             | `storage-adapter.interface.ts` (المقبس)، `local-storage.adapter.ts` (تطوير/اختبار)، `r2-storage.adapter.ts` (إنتاج) |
| `entities/*` · `dto/*`                                                 | مخرجات الإدارة/العامّة، واستعلام القائمة + `UpdateMediaAltDto`                                                      |

## خريطة الاتصال

- **وارد:** `MediaDescriptorResolver` تستهلكه `projects`/`articles`/`testimonials`/`settings`/`seo` لحقن الواصفات — خمس وحدات، وكلّها تستورد `MediaModule`.
- **يعتمد على:** `PrismaService`، و`LocalesService` (تحقّق لغة النصّ البديل — الوحدة تستورد `LocalesModule`)، و`StorageAdapter` عبر رمز الحقن `STORAGE_ADAPTER` (`@Inject`)، و`Sharp`، ومُحمّل `file-type` (`ESM`) لكشف البايتات السحرية.

## التدفّقات

### الرفع — `POST /admin/media` (متعدّد الأجزاء، `media.create`)

```
sniff (file-type) → نوع مكتشَف من البايتات (مرجعي) → يُطابَق مع الامتداد + Content-Type المُعلَن
  صورة؟ → سقف 40 MP (MAX_INPUT_PIXELS) → Sharp master (WebP q90, auto-orient, تجريد الميتاداتا)
        → بدائل WebP/AVIF عند 640/1280/1920 (لا تكبير) ضمن ميزانية العرض×الصيغة → BlurHash 4×3
  PDF؟   → تحقّق بنيوي (يبدأ بـ %PDF- وينتهي بـ %%EOF) — بلا تحليل كامل
  → SHA-256 على البايتات الأصلية (contentHash فريد) → موجود مسبقًا؟
      نعم → 200 مع meta.deduplicated=true (الأصل القائم، بلا رفع جديد)
      لا  → limiter (سقف 2) → كتابة الكائنات ثم صف DB → 201
```

الأصل الخام **لا يُخزَّن أبدًا**؛ يُحتفَظ فقط بالـ `master` المعقَّم للتوليد المستقبلي. حدّ الرفع `10 MiB` (`MAX_UPLOAD_BYTES`) مطبَّق في `Multer` وكدفاع في العمق. مفتاح كل كائن عشوائي تحت بادئة واحدة (`MEDIA_KEY_ROOT = 'media'`)؛ اسم الملف الأصلي لا يظهر في أي مفتاح أو مسار عام.

### الحذف والاستخدامات

- `GET /admin/media/:id/usages` (`media.read`): يعدّد كل مفتاح خارجي يشير إلى الأصل، في استعلام واحد (لا `N+1`).
- `DELETE /admin/media/:id` (`media.delete`): إن كان مُشارًا إليه → **`409`** مع تعداد `usages` في الجسم، دون لمس أي صفّ أو كائن؛ وإلا يحذف الصفّ + البدائل + الكائنات ويُعيد **`204`**.

#### ترتيب الحذف: قاعدة البيانات أوّلًا (`D07-7`)

الفحص المسبق للاستخدامات **ليس** حدّ الصحّة — فهو قراءة قديمة لحظةَ تنفيذ الحذف. الحدّ الحقيقي هو
مفتاح `RESTRICT` الأجنبي، ولا يستطيع حماية الأصل إلّا **ما دامت كائناته موجودة**. لذلك الترتيب:

1. قراءة مفاتيح التخزين من الصفوف التي ستُحذف (لا تُشتقّ من اصطلاح تسمية).
2. `prisma.mediaAsset.delete` — **نقطة الالتزام**. عملية واحدة هي معاملتها الخاصّة، والبدائل والنصوص
   البديلة تُحذف بـ `CASCADE` داخلها؛ فلا حاجة لـ `$transaction` صريحة. الحذف المرفوض يتراجع عن
   `CASCADE` الخاصّ به كاملًا.
3. تنظيف الكائنات **بعد** نجاح الالتزام فقط، وخارج أي معاملة (لا تُترك معاملة `PostgreSQL` مفتوحة
   أثناء نداء شبكة إلى `R2`).

سباق: إن ظهر مرجع جديد بين القراءة والحذف، يرفض المفتاح الأجنبي الحذف (`P2003`) → **الصفّ والكائنات
سليمة تمامًا** → تُعاد قراءة `usages` ويُرجَع نفس عقد **`409`**. أمّا `P2025` (حذف متزامن سبقنا) فيمرّ
كما هو إلى `AllExceptionsFilter` → **`404`**، ولا يُحوَّل إلى `409` كاذب.

فشل التنظيف **بعد** الالتزام لا يغيّر نتيجة الطلب: الصفّ محذوف فعلًا، فيبقى الردّ **`204`** ويُسجَّل
`media.delete_orphaned_objects` (معرّف الأصل، المفاتيح الفاشلة فقط، عددها، السائق) ليزيلها المشغِّل
يدويًّا. كائن يتيم = بايتات مهدورة لا يراها أحد، وهو **أأمن** من صفّ حيّ يشير إلى كائن غير موجود —
وذلك عكس ما كان يفعله الترتيب القديم (الكائنات أوّلًا ثمّ الصفّ)، وهو الخطأ الذي صُحِّح.

### التحقّق والحدود (`422`)

نوع غير مدعوم، أو تزييف المحتوى (البايتات لا تطابق النوع المُعلَن/الامتداد)، أو صورة تتجاوز `40 MP`، أو `PDF` مشوَّه/مبتور → **`422`** (RFC 7807).

### السقف والخنق (`429`)

- **معدّل الرفع:** `10/دقيقة` لكل مستخدِم مُصادَق + `IP` عبر `UploadUserIpThrottlerGuard` (محلّي للمسار، بعد حرّاس المصادقة/الصلاحية؛ يفشل **مغلقًا بـ `401`** إن غاب `request.user` أو `IP` موثوق — لا رجوع لخنق `IP` فقط).
- **سقف المعالجة:** `MAX_CONCURRENT_PROCESSING = 2` متزامنة لكل نسخة؛ رفعٌ إضافي أثناء الانشغال → **`429`** + `Retry-After` (`PROCESSING_RETRY_AFTER_SECONDS = 2`) ولا يُصفّ أبدًا.

### التعويض وضمان انعدام اليتامى في **الرفع** (`D07-6`)

> يحكم هذا القسم مسار **الرفع** وحده، ولا يُعمَّم على الحذف. مسار الحذف محكوم بـ `D07-7` أعلاه،
> وترتيبه معاكس **عمدًا**: الخطوة غير القابلة للتراجع تأتي أخيرًا في الاتجاهين — الكائنات قبل الصفّ
> عند الدخول، وبعده عند الخروج.

الكائنات تُكتَب **قبل** صفّ `DB`؛ عند أي فشل بعد الكتابة يُستدعى `compensate`: `storage.deleteMany` للكائنات المرفوعة بالضبط. سباق محتوى مكرِّر يُحلّ لصالح **الفائز** (إعادة فحص `contentHash`). التنظيف لا يرمي أبدًا. **والضمان غير متماثل عمدًا، فلا تقرأه ضمانًا واحدًا:** لا صفّ يتيم **قطعًا** — الصفّ لا يُلتزَم أصلًا عند الفشل — أمّا حذف الكائنات فـ**بذل أفضل**: إن أخفق حذف بعضها **بقيت**، ويُسجَّل `media.compensation_incomplete` ومعه أسماؤها. وهذا مقبول للسبب نفسه المذكور في مسار الحذف أعلاه: الكائن اليتيم بايتات مهدورة لا يراها أحد، والصفّ اليتيم عطلٌ يراه المستخدم.

## العقود والثوابت

- **الصيغ:** صور `JPEG`/`PNG`/`WebP`/`AVIF` (النوع المكتشَف بالبايتات مرجعيّ، ويُقاطَع مع الامتداد و`Content-Type`)؛ **لا دعم `GIF`**، و`SVG` ممنوع (قابل للسكربتة، بلا بايتات سحرية). `PDF` (`application/pdf`) هو النوع غير الصوري الوحيد ويخصّ خانة السيرة الذاتية فقط.
- **الصلاحيات:** `media.create` / `media.read` / `media.update` / `media.delete` عبر `@RequirePermission` تحت `PermissionsGuard` (رفض افتراضي؛ لا `@Public` مطلقًا). بلا رمز → **`401`**؛ رمز بلا الصلاحية → **`403`**.
- **المسارات الإدارية:** `POST /admin/media` (201/200)، `GET /admin/media` (قائمة مُرقّمة، بحث في الاسم + النص البديل، مرشِّح `kind`)، `GET /admin/media/:id`، `PATCH /admin/media/:id` (ضبط/مسح نصّ بديل لكل لغة: `""` = زخرفيّ، `null` = إزالة)، `GET /admin/media/:id/usages`، `DELETE /admin/media/:id`.
- **الجداول:** `media_assets` (`MediaAsset`: `kind`, `originalFilename`, `sizeBytes`, `contentHash` فريد، `width?`/`height?`/`blurhash?`)، `media_asset_variants` (`format`, `width`, `height`, `sizeBytes`, `overBudget`؛ `@@unique([mediaAssetId, format, width])`)، `media_asset_alts` (`locale`, `text`). اتّساق `kind↔الحقول` (صورة ⇒ `width/height/blurhash` + `image/webp`؛ `PDF` ⇒ الكل `null` + `application/pdf`) قيد `CHECK` في `DB`.
- **الميزانيات:** عرض البدائل `640/1280/1920` (`RENDITION_WIDTHS`) بميزانية بايت لكل عرض×صيغة، وسُلّم جودة (`webp` من `78` إلى `55`، `avif` من `55` إلى `40`، خطوة `8`)؛ يُرفع `overBudget` إن بقي عند الأرضية فوق الميزانية.
- **الواصفات العامّة (`descriptors`):** تُضاف على القراءات العامّة **بجانب** حقول `*Id` المحفوظة — **باستثناء واحد مُثبَت في العقد: `SiteSettings.resumeAssetId`، فالواصف `resumeAsset` يحلّ محلّه ولا يظهر الـ `*Id` الخام في `PublicSiteSettingsEntity`** (القسم ٦.٥ من الدليل؛ و`openapi.json` هو الفصل عند الشكّ). وهي أضيق من كيان الإدارة (بلا `overBudget`، بلا مفاتيح تخزين، بلا `contentHash`، بلا رابط `master`). كل `url` مطلق على أصل الوسائط (لا أصل الـ `API`). `PublicMediaImageDescriptor.url` = أوسع بديل `WebP`؛ و`blurhash`/`alt` قابلان لـ `null` (`null` = لا ترجمة/لا رجوع، `""` = زخرفيّ). `PublicMediaPdfDescriptor` يحمل `filename` + `sizeBytes`.
- **عقد `OpenAPI` القابل لـ `null`:** الحقول القابلة لـ `null` من نوع `$ref` تُصدَّر كـ `{ nullable: true, allOf: [$ref] }` (دون `type: object`)، وهو التمثيل الوحيد الذي يقبله `jest-openapi`/`AJV` الصارم للقيمة `null`.
- **التخزين:** `LocalStorageAdapter` للتطوير/الاختبار (`STORAGE_DRIVER=local`، `STORAGE_LOCAL_DIR`، يُخدَم عند `PUBLIC_MEDIA_URL`)؛ و`R2StorageAdapter` المتوافق مع `S3` للإنتاج على `Cloudflare R2` (`STORAGE_DRIVER=s3`، `S3_ENDPOINT`/`S3_BUCKET`/`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`/`S3_REGION`). المقبس `STORAGE_ADAPTER` (`D07-4`)؛ لا كود أعمال يمسّ `SDK` تخزين. كل كائن يُكتَب بـ `Content-Type` صحيح؛ الصور بـ `Cache-Control: public, max-age=31536000, immutable`، والـ `PDF` يضيف `Content-Disposition: attachment`.

## الترحيل وقاعدة الإنتاج

المخطّط يُطبَّق بـ `prisma migrate deploy` **فقط** في الإنتاج (تقدّم للأمام — `doc 09 §6`)؛ لا `migrate reset` ولا حذف/تصفير للإنتاج مطلقًا. هجرة الميزة تضيف `MediaKind`/`MediaVariantFormat`، وجدول البدائل، وأعمدة `media_assets`، وقيود `CHECK` — إضافيّة بالكامل.

## الاختبارات وما تُثبته

- **وحدات:** `media.service.spec.ts`، `media-processing.service.spec.ts`، `media-processing.util.spec.ts`، `processing-concurrency.limiter.spec.ts`، `retry-after.interceptor.spec.ts`، `media-descriptor.resolver.spec.ts`، ومحوّلا التخزين.
- **e2e:** `test/media.e2e-spec.ts` — `401/403`، رفع مُصرَّح `201` (`master` + بدائل `WebP`/`AVIF`)، إزالة تكرار `200` + `meta.deduplicated`، حذف محميّ `409` + `usages` ثم `204`، امتداد صورة مُزوَّر ببايتات ليست صورة `422` (بلا صفّ يتيم) — لا «كلّ ما ليس صورة»، فالـ `PDF` نوع مدعوم يُقبَل بـ `201`، الواصف العامّ حاضرًا **و** `null` — كلاهما مطابق للعقد، `429` + `Retry-After`، وتعويض فشل الرفع (`deleteMany` بلا صفّ يتيم)، و**سباق المرجع المُلتزَم**: مرجع يُلتزَم أثناء الحذف → حاجز قفل صفّ حقيقي (`pg_blocking_pids`، بلا `sleep`) → `409` مع الكائنات **باقية على القرص**، وحذف غير مُشار إليه يزيل كل مفتاح مرّة واحدة بالضبط. يتطلّب `NODE_OPTIONS=--experimental-vm-modules` لمُحمّل `file-type` الـ `ESM`.
- **تحقّق الإنتاج (`R2`):** دورة كاملة مُتحقَّق منها فعليًّا مقابل الإنتاج — رفع `201` → جلب الـ `master` والبديلين `WebP`+`AVIF` من أصل الوسائط بـ `Content-Type` صحيح و`Cache-Control` غير قابل للتغيير → `usages` صفر → حذف `204`.

## القيود المقبولة (موثّقة سلفًا)

- **تغطية `PDF` جزئيّة، لا غائبة:** رفع سيرة `PDF` **من عمل هذه الوحدة** (انظر صدر الملفّ)، و`media.e2e-spec.ts` لا يغطّي فرعه ولا دورة حياة المرفق — غير أنّ `page-seo.e2e-spec.ts` **يرفع `PDF` حقيقيًّا** عبر `/admin/media` ويؤكّد `201` و`kind = PDF`، ضابطًا لاختبار آخر. ويكفي هنا `resumeAsset = null` + التحقّق البنيوي لواصف `PDF`.
- **لا اختبار تكامل `R2` حقيقي في `CI`:** التخزين يُتحقَّق منه بالمحوّل المحلّي وبمُحاكيات حتمية؛ اختبار `checksum` مقابل `R2` حقيقي مُبوَّب.
- **بنود `e2e` مؤجَّلة:** حدّ `40 MP` وترويسات الكائن عند الجلب (مغطّاة بالوحدات).

## المرجع الرسمي وحالة التوافق

- [NestJS File upload](https://docs.nestjs.com/techniques/file-upload) · [Sharp](https://sharp.pixelplumbing.com/) · [Prisma transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) · [Cloudflare R2 (S3 API)](https://developers.cloudflare.com/r2/api/s3/) · [OpenAPI 3.0 `nullable`](https://spec.openapis.org/oas/v3.0.3#schema-object).

**حالة التوافق:**

- **`StorageAdapter` عبر رمز حقن + `@aws-sdk/client-s3`:** `Compatible` — المقبس النظيف يُبقي كود الأعمال بلا `SDK`، و`R2` يُستهلَك عبر واجهة `S3` الرسمية.
- **كشف النوع بـ `file-type` (`ESM`) + `Sharp`:** `Compatible` — البايتات السحرية مرجعيّة، لا الامتداد/الترويسة؛ يتطلّب `--experimental-vm-modules` لتحميل `ESM` من `Jest`.
- **`nullable $ref` بـ `allOf` بلا `type: object`:** `Compatible` — التمثيل الوحيد المقبول في `OpenAPI 3.0` لدى `jest-openapi`/`AJV` الصارم للقيمة `null`.

**لم يُرصَد انحراف غير مُفسَّر في هذه الوحدة.**

## استخدام جديد: صورة «عن» (الميزة 008)

أُضيف نوع الاستخدام `settings-portrait` إلى `MEDIA_USAGE_TYPES` بجانب `settings-resume`.
الصورة الشخصية في `SiteSettings.portraitAssetId` تُعامَل كأي مرجع آخر:

- تظهر في `GET /admin/media/{id}/usages`؛
- تمنع الحذف بالاستجابة `409` المُهيكلة نفسها ما دامت مرجوعة؛
- المفتاح الأجنبي `RESTRICT`؛
- تفريغ الحقل أو استبداله يُعيد توجيه العلاقة **دون حذف** الأصل القابل لإعادة الاستخدام.

الفرق الوحيد عن الـ PDF: الصورة يجب أن تكون من نوع `IMAGE`، ويُرفض غير ذلك بـ `422`.
