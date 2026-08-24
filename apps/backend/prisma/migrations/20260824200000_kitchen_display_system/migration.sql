-- CreateEnum
CREATE TYPE "KitchenTicketStatus" AS ENUM ('NEW', 'ACCEPTED', 'COOKING', 'READY', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "kitchen_tickets" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "status" "KitchenTicketStatus" NOT NULL DEFAULT 'NEW',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kitchen_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kitchen_tickets_ticketNumber_key" ON "kitchen_tickets"("ticketNumber");

-- CreateIndex
CREATE INDEX "kitchen_tickets_orderId_idx" ON "kitchen_tickets"("orderId");

-- CreateIndex
CREATE INDEX "kitchen_tickets_status_priority_createdAt_idx" ON "kitchen_tickets"("status", "priority", "createdAt");

-- AddForeignKey
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
