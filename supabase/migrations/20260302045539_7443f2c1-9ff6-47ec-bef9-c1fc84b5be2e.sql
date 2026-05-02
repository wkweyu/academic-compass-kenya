
-- Fix corrupted student ledger data by recalculating from actual transactions
UPDATE fees_student_ledger l
SET 
  debit_total = COALESCE(d.total, 0),
  credit_total = COALESCE(c.total, 0),
  balance = COALESCE(d.total, 0) - COALESCE(c.total, 0),
  last_updated = now()
FROM (
  SELECT school_id, student_id, SUM(amount) as total 
  FROM fees_debittransaction 
  GROUP BY school_id, student_id
) d
LEFT JOIN (
  SELECT school_id, student_id, SUM(amount) as total 
  FROM fees_receipt 
  WHERE is_reversed = false 
  GROUP BY school_id, student_id
) c ON d.school_id = c.school_id AND d.student_id = c.student_id
WHERE l.school_id = d.school_id AND l.student_id = d.student_id;
