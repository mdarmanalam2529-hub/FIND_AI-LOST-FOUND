-- ==============================================================================
-- Migration: 20261025100000_harden_foreign_key_preservation.sql
-- Project: FindAI - University Lost-and-Found Platform
-- Phase 1 - Stage 1: Foreign Key Hardening & Historical Data Preservation (REVISED)
--
-- Objective:
-- 1. Replace destructive ON DELETE CASCADE on public.items.user_id and
--    public.item_claims.claimant_id with ON DELETE RESTRICT.
-- 2. Dynamically discover constraint names to prevent failure if default names differ.
-- 3. Execute pre-flight integrity assertions verifying zero orphan rows exist before
--    constraint replacement.
-- 4. Preserve existing items, claims, handovers, and notifications without data loss.
-- 5. Safe, idempotent, transactional, and reversible without restoring cascade hazards.
-- ==============================================================================

DO $$
DECLARE
    v_item_fk text;
    v_claim_fk text;
    v_review_fk text;
BEGIN
    -- --------------------------------------------------------------------------
    -- 1. Pre-Flight Integrity Assertions
    -- --------------------------------------------------------------------------
    -- Abort immediately if any orphan row exists in public.items
    IF EXISTS (
        SELECT 1 FROM public.items i
        WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = i.user_id)
    ) THEN
        RAISE EXCEPTION 'Pre-flight check failed: public.items contains rows referencing non-existent auth.users.';
    END IF;

    -- Abort immediately if any orphan row exists in public.item_claims
    IF EXISTS (
        SELECT 1 FROM public.item_claims c
        WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.claimant_id)
    ) THEN
        RAISE EXCEPTION 'Pre-flight check failed: public.item_claims contains rows referencing non-existent auth.users (claimant_id).';
    END IF;

    -- --------------------------------------------------------------------------
    -- 2. Protect public.items.user_id (ON DELETE RESTRICT)
    -- --------------------------------------------------------------------------
    -- Dynamically locate any existing foreign key on items(user_id) -> auth.users(id)
    SELECT c.conname INTO STRICT v_item_fk
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    JOIN pg_attribute ar ON ar.attrelid = c.confrelid AND ar.attnum = ANY(c.confkey)
    WHERE n.nspname = 'public'
      AND t.relname = 'items'
      AND c.contype = 'f'
      AND a.attname = 'user_id'
      AND ar.attname = 'id'
      AND c.confrelid = (
            SELECT oid FROM pg_class
            WHERE relname = 'users'
              AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')
          )
      AND array_length(c.conkey, 1) = 1
      AND array_length(c.confkey, 1) = 1;

    IF v_item_fk IS NULL THEN
        RAISE EXCEPTION 'Expected single-column foreign key on items(user_id) → auth.users(id) not found – aborting migration.';
    END IF;

    -- --------------------------------------------------------------------------
    -- 3. Protect public.item_claims.claimant_id (ON DELETE RESTRICT)
    -- --------------------------------------------------------------------------
    -- Locate existing foreign key for claimant_id
    SELECT c.conname INTO STRICT v_claim_fk
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    JOIN pg_attribute ar ON ar.attrelid = c.confrelid AND ar.attnum = ANY(c.confkey)
    WHERE n.nspname = 'public'
      AND t.relname = 'item_claims'
      AND c.contype = 'f'
      AND a.attname = 'claimant_id'
      AND ar.attname = 'id'
      AND c.confrelid = (
            SELECT oid FROM pg_class
            WHERE relname = 'users'
              AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')
          )
      AND array_length(c.conkey, 1) = 1
      AND array_length(c.confkey, 1) = 1;

    IF v_claim_fk IS NULL THEN
        RAISE EXCEPTION 'Expected single-column foreign key on item_claims(claimant_id) → auth.users(id) not found – aborting migration.';
    END IF;

    -- --------------------------------------------------------------------------
    -- 4. Preserve reviewed_by on public.item_claims (ON DELETE SET NULL)
    -- --------------------------------------------------------------------------
    SELECT c.conname INTO STRICT v_review_fk
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    JOIN pg_attribute ar ON ar.attrelid = c.confrelid AND ar.attnum = ANY(c.confkey)
    WHERE n.nspname = 'public'
      AND t.relname = 'item_claims'
      AND c.contype = 'f'
      AND a.attname = 'reviewed_by'
      AND ar.attname = 'id'
      AND c.confrelid = (
            SELECT oid FROM pg_class
            WHERE relname = 'users'
              AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')
          )
      AND array_length(c.conkey, 1) = 1
      AND array_length(c.confkey, 1) = 1;

    IF v_review_fk IS NULL THEN
        RAISE EXCEPTION 'Expected single-column foreign key on item_claims(reviewed_by) → auth.users(id) not found – aborting migration.';
    END IF;

    -- All three foreign keys have been validated. Proceed to drop existing constraints.
    EXECUTE format('ALTER TABLE public.items DROP CONSTRAINT %I', v_item_fk);
    EXECUTE format('ALTER TABLE public.item_claims DROP CONSTRAINT %I', v_claim_fk);
    EXECUTE format('ALTER TABLE public.item_claims DROP CONSTRAINT %I', v_review_fk);

    -- Re‑create constraints with the required ON DELETE behaviour.
    ALTER TABLE public.items
        ADD CONSTRAINT items_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE RESTRICT;

    ALTER TABLE public.item_claims
        ADD CONSTRAINT item_claims_claimant_id_fkey
        FOREIGN KEY (claimant_id)
        REFERENCES auth.users(id)
        ON DELETE RESTRICT;

    ALTER TABLE public.item_claims
        ADD CONSTRAINT item_claims_reviewed_by_fkey
        FOREIGN KEY (reviewed_by)
        REFERENCES auth.users(id)
        ON DELETE SET NULL;

END $$;
