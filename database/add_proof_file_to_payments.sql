-- Add proof_file column to payments table
-- This column stores the path to uploaded payment proof (screenshot/receipt)

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS proof_file VARCHAR(500) NULL 
COMMENT 'Path to uploaded payment proof (screenshot/receipt)' 
AFTER notes;
