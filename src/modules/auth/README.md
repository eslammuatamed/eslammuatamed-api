# `auth` — المصادقة (login / refresh / logout)

> اقرأ [`src/modules/README.md`](../README.md) أولًا (الشكل القانوني)، ثم هذا الملف لتفاصيل الأمان. التصميم الحاكم في [الوثيقة 19 (Security)](../../../../eslammuatamed-docs/docs/19-security.md).

## المسؤولية

إصدار الجلسات والتحقّق منها: تسجيل الدخول، تدوير الـ refresh token، تسجيل الخروج، وتوفير آلية تجزئة كلمة المرور. **التفويض (الصلاحيات) ليس هنا** — هو في وحدة `access-control`. هذه الوحدة تُجيب عن «مَن أنت؟» لا «ماذا يُسمح لك؟».

## خريطة الملفّات

| الملف | الدور |
|---|---|
| `auth.module.ts` | يسجّل `JwtModule` **عالميًّا** (`global: true`) بسرّ وTTL من الإعداد؛ يُصدِّر `PasswordService` |
| `auth.controller.ts` | ثلاث نقاط عامّة: `POST /auth/login`, `/auth/refresh`, `/auth/logout` |
| `auth.service.ts` | تنسيق الدخول/التجديد/الخروج |
| `cookies.ts` | خيارات كوكي الـ refresh (`httpOnly; Secure(prod); SameSite=Lax; path=/api/v1/auth`) |
| `hashing/password.service.ts` | `hash`/`verify` عبر `argon2` |
| `hashing/argon2.options.ts` | معاملات `argon2id` (مشتركة مع الـ seed) |
| `tokens/refresh-token.service.ts` | إصدار/تدوير/إبطال الـ refresh tokens مع كشف إعادة الاستخدام |
| `tokens/access-token.payload.ts` | نوع حمولة الـ JWT (`{ sub }` فقط) |
| `dto/login.dto.ts` · `entities/auth.entities.ts` | مدخلات/مخرجات مُتحقَّقة ومُوثّقة |

## خريطة الاتصال

- **وارد:** `common/guards/jwt-auth.guard.ts` يحقن `JwtService` (المُسجَّل عالميًّا هنا) للتحقّق من التوكن. `access-control` يستورد `AuthModule` لاستخدام `PasswordService` المُصدَّر (تجزئة حسابات جديدة).
- **صادر:** `PasswordService` فقط.
- **يعتمد على:** `UsersService` (بحث الحسابات)، `PrismaService` (جدول `RefreshToken`)، `AppConfigService` (الأسرار)، `JwtService`.

## التدفّقات

### الدخول — `POST /api/v1/auth/login`
```
findByEmail(email)
  → فشل موحّد لبريد مجهول أو كلمة مرور خاطئة (منع تعداد المستخدمين — doc 19 §1)
  → حساب معطّل (isActive=false) → 401
  → issueNewFamily(userId): refresh token عشوائي 256-bit، familyId جديد، مُخزَّن مُجزّأً
  → signAccessToken(user): jwt.signAsync({ sub })  (HS256، 15 دقيقة)
  → يضع كوكي refresh + يُرجِع { accessToken, user }
```

### التجديد — `POST /api/v1/auth/refresh`
```
rotateOrThrow(presentedToken):
  ابحث عن hash(token)
   ├─ غير موجود → 401
   ├─ revokedAt مضبوط → إشارة سرقة: أبطِل العائلة كلها → 401
   ├─ منتهٍ → 401
   └─ صالح → في $transaction: أبطِل القديم + أنشئ جديدًا بنفس familyId
  → access token جديد + كوكي refresh جديد
```

### الخروج — `POST /api/v1/auth/logout`
يُبطِل العائلة كلها (idempotent: توكن مجهول = لا عمل) ويمسح الكوكي.

## قرارات الأمان الجوهرية (شرح لمطوّر مبتدئ)

- **access token يحمل `sub` فقط.** لا أدوار ولا صلاحيات داخله. لماذا؟ لأن التفويض يُحلّ من قاعدة البيانات في كل طلب (`PermissionsGuard`)، فتغيير صلاحية يسري **فورًا** بدل انتظار انتهاء التوكن (15 دقيقة). (`D19-8`)
- **refresh token مُعتِم (opaque) لا JWT.** قيمة عشوائية 256-bit تُخزَّن **مُجزّأة** بـ `HMAC-SHA256` بمفتاح `pepper` من البيئة. تسريب قاعدة البيانات وحده لا يكفي لعكس التوكنات (لا يملك المهاجم الـ pepper). (`D19-2/§7`)
- **التدوير + كشف إعادة الاستخدام (`familyId`).** كل تجديد يُبطِل القديم؛ تقديم عضو مُبطَل = دليل سرقة → إبطال العائلة كلها وإجبار إعادة الدخول.
- **طوبولوجيا الكوكي (`SameSite=Lax`).** `web` و`api` يتشاركان نطاقًا قابلًا للتسجيل (`eslammuatamed.com`/`api.eslammuatamed.com`)، فالكوكي same-site: `Lax` يعمل دون هشاشة كوكيات الطرف الثالث، ويحصر CSRF على تنقّلات المستوى الأعلى التي يمنع `Lax` منها POST. (`D19-3`)
- **تثبيت الخوارزمية `HS256`** في التوقيع والتحقّق يمنع خفض الرتبة إلى `alg: none` أو خلط الخوارزميات.

## العقود والثوابت

- الفشل عند الدخول موحّد دائمًا (لا تسريب: بريد مجهول أم كلمة مرور خاطئة).
- الـ refresh token الخام لا يُخزَّن أبدًا — فقط تجزئته المُفتَّحة (keyed hash).
- `PasswordService.verify` يعامل أي فشل (بما فيه hash تالف) كـ «غير مُتحقَّق» فلا يُصادِق hash فاسد أبدًا.

## الاختبارات وما تُثبته

`tokens/refresh-token.service.spec.ts` (التدوير، كشف إعادة الاستخدام، الإبطال)، و`test/auth.e2e-spec.ts` (دورة الدخول/التجديد/الخروج الكاملة + تأكيد العقد). المعاملات في `argon2.options.ts` مشتركة مع `prisma/seed.ts` فتُنتَج الـ hashes بنفس السياسة في كل مكان.

## وصفات تعديل + أخطاء شائعة

- **تغيير TTL للـ access token:** عدّل `JWT_ACCESS_TTL` في البيئة (مُتحقَّق بصيغة مدّة) — لا ترميز صلب.
- **مراجعة معاملات `argon2`:** في `argon2.options.ts` فقط (مكان واحد، تُراجَع سنويًّا).
- **خطأ شائع:** إضافة أدوار/صلاحيات إلى حمولة الـ JWT — يكسر «سريان الصلاحيات فورًا» (`D19-8`).
- **خطأ شائع:** تخزين الـ refresh token خامًا أو بلا pepper.

## المرجع الرسمي وحالة التوافق

- [NestJS Authentication](https://docs.nestjs.com/security/authentication) · [@nestjs/jwt](https://github.com/nestjs/jwt) · [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) · [argon2 (node)](https://github.com/ranisalt/node-argon2) · [MDN — SameSite cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite).

**حالة التوافق:**
- **حارس قائم على `JwtService` (تحقّق مباشر من الـ JWT):** `Compatible` — **وليس انحرافًا** عن التوثيق الرسمي. المشروع يتحقّق من الـ JWT مباشرةً بـ `JwtService`، وهذا **مدعوم رسميًّا** في توثيق مصادقة `NestJS` نفسه (`NestJS → Security → Authentication`: `JwtModule.registerAsync`، `signAsync`، `verifyAsync`، وحارس يقرأ الـ Bearer). أمّا `passport-jwt` و`@nestjs/passport` فهما **بديلان اختياريان** لمن يختار استراتيجيات `Passport`، ولا يستخدمهما المشروع لأن متطلّباته الحالية لا تحتاج تلك الطبقة (abstraction). القرار `D00-6` يسجّل **اختيار المشروع** لهذا النمط، لكنه **ليس انحرافًا عن إرشاد `NestJS` الرسمي** — فكلا النمطين مدعوم. (لا وجود لأي تبعية `passport*` في هذا الأساس.)
- **`argon2id` (64 MiB, t=3, p=4):** `Compatible` — **يفي بل يفوق** الحدّ الأدنى الحالي لـ OWASP لـ Argon2id، وهو الخيار الأول في توصية OWASP على `bcrypt`. القرار `D19-1`، وأُعيد تأكيده في مراجعة الوثيقة 19 (v1.2.1) على أساس ترتيب OWASP (Argon2id أوّلًا).
- **تدوير refresh + كشف إعادة الاستخدام + كوكي `SameSite=Lax`:** `Compatible` — أنماط جلسات معياريّة مُوثّقة (`D19-2/D19-3`)؛ لا تخالف أي مصدر رسمي.

**لم يُرصَد انحراف غير مُفسَّر في هذه الوحدة.**
