-- Add program column to keywords table
ALTER TABLE public.keywords ADD COLUMN program text DEFAULT NULL;
