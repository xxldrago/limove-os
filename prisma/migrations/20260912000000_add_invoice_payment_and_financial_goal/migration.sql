-- Migration: add invoice payment fields + financial goals
-- Run with: npx prisma migrate deploy  OR apply manually to the postgres DB.

-- 1) Invoice: add new columns (nullable so existing rows are safe)
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "paidById" INTEGER;

-- Unique index on invoiceNumber (Invite INV-XXXX)
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoiceNumber_key" ON "invoices" ("invoiceNumber");

-- Keep the existing unique list of columns in step with prisma @@index([status, dueDate])
CREATE INDEX IF NOT EXISTS "invoices_status_dueDate_idx" ON "invoices" ("status", "dueDate");

-- 2) Financial goal table
CREATE TABLE IF NOT EXISTS "financial_goals" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "targetAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "financial_goals_pkey" PRIMARY KEY ("id")
);

-- Unique year
CREATE UNIQUE INDEX IF NOT EXISTS "financial_goals_year_key" ON "financial_goals" ("year");