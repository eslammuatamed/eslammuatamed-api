-- Contact: nullable visitor email + new visitor phone, and the owner's public numbers
-- (D09-19, D10-16).

-- AlterTable
ALTER TABLE "contact_messages" ADD COLUMN     "phone" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "contact_phone" TEXT,
ADD COLUMN     "whatsapp_phone" TEXT;

-- The at-least-one-contact-method invariant (D09-19).
--
-- This is the schema's FIRST check constraint, and it is deliberately in the database rather than
-- only in the DTO. Application validation is bypassable by a seed, a console session, a later
-- migration or a future endpoint, and the one row that must never exist is a stored message with no
-- way to answer it. The DTO and service validation are unchanged and remain what produces the
-- friendly 422; this is the backstop that makes the invariant true regardless of who writes.
--
-- Prisma cannot model a CHECK constraint, so it exists only here and is invisible in
-- schema.prisma — which is precisely why doc 09 D09-19 records it.
--
-- Written against the TRIMMED value: a whitespace-only string is not a contact method. `btrim` with
-- no second argument strips spaces only, so the character class is spelled out to cover the tab,
-- newline and carriage return the API also trims (D10-15).
--
-- Existing rows are safe: `email` was NOT NULL until this migration, so every pre-existing row
-- already satisfies the constraint and it validates without a rewrite.
ALTER TABLE "contact_messages"
  ADD CONSTRAINT "contact_messages_contact_method_present"
  CHECK (
    btrim(COALESCE("email", ''), E' \t\n\r') <> ''
    OR btrim(COALESCE("phone", ''), E' \t\n\r') <> ''
  );
