-- One-off cleanup: remove quotes that are empty drafts (status='draft', total=0,
-- and no quote_lines). These were created by clicking "הצעה חדשה" without ever
-- adding a line. Going forward the QuoteEditorDialog auto-deletes such drafts
-- on close — this migration just clears the existing backlog.
DELETE FROM public.quotes
WHERE status = 'draft'
  AND total_incl_vat = 0
  AND id NOT IN (SELECT DISTINCT quote_id FROM public.quote_lines);
