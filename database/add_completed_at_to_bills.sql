-- Migration: Add completed_at column to bills table
-- This column stores the timestamp when a bill status changes to 'paid' (completed)

ALTER TABLE bills 
ADD COLUMN completed_at DATETIME NULL 
COMMENT 'Timestamp when bill status changed to paid (completed)';

-- Add index for faster queries on completed bills
CREATE INDEX idx_bills_completed_at ON bills(completed_at);

-- Update existing paid bills to set completed_at to their updatedAt timestamp
UPDATE bills 
SET completed_at = updatedAt 
WHERE status = 'paid' AND completed_at IS NULL;

