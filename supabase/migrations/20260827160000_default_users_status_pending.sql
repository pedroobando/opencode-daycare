-- supabase/migrations/20260827160000_default_users_status_pending.sql
--
-- Fix: change public.users.status default from 'active' to 'pending'.
-- Previously, the handle_new_user trigger created users with status='active'
-- immediately after signup. If the activation flow failed after signup but
-- before creating the parent_children link, the user was left in an
-- inconsistent state: "active" but with no parent↔child relationship.
--
-- With this change, new users start as 'pending' and only become 'active'
-- after the full activation flow completes (signUp → acceptInvitationByCode
-- → explicit UPDATE status='active').

alter table public.users
  alter column status set default 'pending'::user_status;
