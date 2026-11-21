-- Supabase may grant new functions to anon through its default privileges.
revoke execute on function public.get_simulado_question_bank(uuid) from anon;
