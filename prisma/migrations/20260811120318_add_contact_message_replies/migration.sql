-- CreateEnum
CREATE TYPE "ContactMessageReplyStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "contact_message_replies" (
    "id" TEXT NOT NULL,
    "contact_message_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ContactMessageReplyStatus" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" TEXT NOT NULL,
    "initiated_by_user_id" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),

    CONSTRAINT "contact_message_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contact_message_replies_contact_message_id_idempotency_key_key" ON "contact_message_replies"("contact_message_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "contact_message_replies" ADD CONSTRAINT "contact_message_replies_contact_message_id_fkey" FOREIGN KEY ("contact_message_id") REFERENCES "contact_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_message_replies" ADD CONSTRAINT "contact_message_replies_initiated_by_user_id_fkey" FOREIGN KEY ("initiated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
