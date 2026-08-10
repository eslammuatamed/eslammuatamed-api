# `access-control` — التفويض (RBAC ديناميكي قائم على الصلاحيات)

> اقرأ [`src/modules/README.md`](../README.md) و[`auth/README.md`](../auth/README.md) أولًا. التصميم الحاكم في [الوثيقة 19 §3](../../../../eslammuatamed-docs/docs/19-security.md).

## المسؤولية

يُجيب عن «ماذا يُسمح لك؟»: إدارة الأدوار (roles) ومنح الصلاحيات (permission grants) وحسابات المشغّلين، **وإنفاذ** الصلاحية المطلوبة على كل نقطة محروسة عبر `PermissionsGuard` العام. الفكرة المحورية: **الأدوار بيانات، وكتالوج الصلاحيات كود** (`D09-7`, `D19-8`).

## خريطة الملفّات

| الملف                                                     | الدور                                                                                               |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `permissions.ts`                                          | كتالوج الصلاحيات (`PERMISSIONS` كـ `const`) + النوع `PermissionKey` + `WILDCARD_PERMISSION` (`'*'`) |
| `guards/permissions.guard.ts`                             | `PermissionsGuard` العام: يحلّ منح المستخدم من DB ويقارنها بالمطلوب                                 |
| `decorators/require-permission.decorator.ts`              | `@RequirePermission('<resource>.<action>')` — مُنمَّط ضدّ الكتالوج (مفتاح مجهول = خطأ ترجمة)        |
| `access-control.service.ts`                               | CRUD الأدوار والمستخدمين + كتالوج للقراءة                                                           |
| `roles.admin.controller.ts` · `users.admin.controller.ts` | نقاط `/admin` المحروسة                                                                              |
| `dto/*` · `entities/*`                                    | مدخلات/مخرجات                                                                                       |

## خريطة الاتصال

- **وارد:** `app.module.ts` يسجّل `PermissionsGuard` عالميًّا (يحتاج فقط `PrismaService` + `Reflector`، وكلاهما عام)؛ كل controller إداري في كل وحدة يستخدم `@RequirePermission`.
- **صادر:** لا شيء (لا خدمة مُصدَّرة). يستورد `AuthModule` لأجل `PasswordService`.
- **يعتمد على:** `PrismaService`, `PasswordService`.

## التدفّق: إنفاذ الصلاحية

```
PermissionsGuard.canActivate (بعد JwtAuthGuard، فـ request.user مضبوط):
  @Public()؟ → اسمح
  لا صلاحية مُعلَنة على المسار؟ → 403 (يفشل مغلقًا — fail closed)
  request.user غائب؟ → 401
  resolveGrants(userId): استعلام DB لأدوار/منح المستخدم + isActive
    ├─ حساب محذوف/معطّل → 401
    ├─ المنح تحوي '*' أو المفتاح المطلوب → اسمح
    └─ غير ذلك → 403 "Missing permission '<key>'"
```

**الحلّ من قاعدة البيانات لكل طلب** هو جوهر التصميم: تعديل دور أو تعطيل مستخدم يسري لحظيًّا، لا ينتظر انتهاء access token.

## قرارات جوهرية (شرح لمطوّر مبتدئ)

- **الكتالوج كود، المنح بيانات.** كل مفتاح صلاحية (`articles.read`, `articles.update`, …) مُعرَّف في `permissions.ts` ومرتبط بدالّة محروسة، فلا يمكن إنشاؤه عبر الـ API (يُكشف للقراءة فقط عبر `GET /admin/permissions`). والكتالوج يسرد القدرات المُنفَّذة فعليًا فقط: اختبار `route-permissions.spec.ts` يُثبت الاتجاهين معًا، فأي مفتاح لا يحرس مسارًا يُسقط البناء (D19-11). المشغّل ينشئ الأدوار ويمنحها مفاتيح من هذا الكتالوج (صفوف `RolePermission`).
- **المنحة `'*'` (superadmin).** تطابق كل صلاحية حاضرة ومستقبلية. الدور `OWNER` (نظامي، غير قابل للتعديل/الحذف) يملكها كمنحته الوحيدة — فلا يستطيع كتالوج متنامٍ أن يحبس المشغّل خارجًا.
- **الأدوار النظامية محميّة.** `isSystem=true` يمنع التعديل/الحذف (422)، وحذف دور مُسنَد لمستخدمين مرفوض حتى إعادة الإسناد.

## ⚠️ ملاحظة حالة مهمّة: الكتالوج يسبق الوحدات

كتالوج `PERMISSIONS` يتضمّن مفاتيح لوحدات **لم تُبنَ بعد** على هذا الأساس: `media.*`, `messages.*`, `seo.*`, `redirects.*`. هذا مقصود (الكتالوج مصدر حقيقة واحد مُصمَّم مسبقًا)، لكن **لا نقاط API مقابلة لها بعد** — تلك النقاط `Planned` (Features 003/004)، لا `Shipped`. لا تستنتج من وجود المفتاح وجود النقطة.

المفاتيح المُنفَّذة فعلًا على هذا الأساس تخصّ: `articles`, `projects`, `categories`, `tags`, `experiences`, `skills`, `testimonials`, `settings`, `roles`, `users`.

## الثوابت والاختبارات

- **نقطة محروسة بلا `@RequirePermission` تفشل مغلقةً** (403 وقت التشغيل) وتفشل اختبار تغطية الميتاداتا (`route-permissions.spec.ts`) وقت البناء.
- المنحة الوحيدة القابلة للتخزين إمّا مفتاح كتالوج أو `'*'` (`isGrantablePermission`).
- الاختبارات: `permissions.guard.spec.ts` (السماح/المنع، `'*'`, حساب معطّل)، `access-control.service.spec.ts`، `route-permissions.spec.ts`، و`test/access-control.e2e-spec.ts`.

## أخطاء شائعة

- إضافة نقطة إدارية دون `@RequirePermission` — تفشل مغلقةً.
- محاولة تخزين صلاحيات في الـ JWT بدل حلّها من DB — يكسر السريان الفوري.
- تعديل الدور `OWNER` أو حذف منحة `'*'` منه.

## المرجع الرسمي وحالة التوافق

- [NestJS Authorization](https://docs.nestjs.com/security/authorization) · [RBAC](https://docs.nestjs.com/security/authorization#rbac-implementation) · [Guards](https://docs.nestjs.com/guards) · [OWASP A01 Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/).

**حالة التوافق:** `Compatible`. النمط (حارس عام + `@SetMetadata` عبر decorator مخصّص + `Reflector`) هو ما يعلّمه توثيق `NestJS → Authorization`. حلّ المنح من قاعدة البيانات لكل طلب (بدل تضمينها في الـ JWT) اختيار مشروع مُوثّق (`D19-8`) يخدم السريان الفوري ويطابق توصية OWASP A01 بالإنفاذ من جانب الخادم — **`Compatible`، لا انحراف غير مُفسَّر**.
