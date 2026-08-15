-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3);

-- Inventory quantity on hand must never be negative.
ALTER TABLE "Inventory" ADD CONSTRAINT "inventory_quantity_on_hand_non_negative" CHECK ("quantityOnHand" >= 0);

-- Inventory transaction quantities must be non-zero.
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "inventory_transaction_quantity_non_zero" CHECK ("quantity" <> 0);
