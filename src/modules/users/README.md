# `users` — حسابات المشغّلين (بلا سطح عام)

> يتبع الشكل القانوني في [`src/modules/README.md`](../README.md). وحدة صغيرة بلا controller.

## المسؤولية

الوصول إلى نموذج `User` لصالح `auth`. **لا سطح عام ولا controller** على هذا الأساس — إدارة الحسابات (إنشاء/تعطيل) تعيش في وحدة `access-control` (لأنها مقترنة بالأدوار). هذه الوحدة موجودة كي يبحث `AuthService` عن الحسابات دون أن يلمس نموذج `User` مباشرةً بنفسه.

## خريطة الملفّات

| الملف | الدور |
|---|---|
| `users.service.ts` | `findByEmail` (مع الدور، للدخول) و`findById` (هويّة + حالة، للتجديد) |
| `users.module.ts` | يُصدِّر `UsersService` |

## خريطة الاتصال

- **وارد:** `AuthModule` يستورد `UsersModule` ويستخدم `UsersService`.
- **يعتمد على:** `PrismaService`.

## لماذا هذا التقسيم (شرح لمطوّر مبتدئ)

فصلُ «قراءة الحساب للمصادقة» (`users`) عن «إدارة الأدوار والحسابات» (`access-control`) يُبقي `auth` مركّزًا على الهويّة، ويمنع دورة استيراد بين الوحدتين: `access-control` يستورد `auth` (لـ `PasswordService`)، فلو أدار `auth` الحسابات أيضًا لتشابكت المسؤوليات.

## العقود والثوابت

- `findByEmail` يُضمِّن الدور (تحتاجه استجابة الدخول)؛ `findById` هويّة + `isActive` فقط (يكفي للتجديد).

## الاختبارات

مغطّاة عبر `auth` (`test/auth.e2e-spec.ts`) و`access-control`.

## المرجع الرسمي وحالة التوافق

- [NestJS shared modules](https://docs.nestjs.com/modules#shared-modules).

**حالة التوافق:** `Compatible`. خدمة مُصدَّرة بلا controller نمط قياسي. **لا انحراف.**
