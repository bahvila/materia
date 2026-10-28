-- Mantém cada tentativa e suas respostas juntas.
-- Isso reduz complexidade sem misturar tentativas de usuários diferentes.

begin;

alter table public.attempts
  add column if not exists respostas jsonb not null default '[]'::jsonb;

do $migration$
begin
  if to_regclass('public.attempt_answers') is not null then
    execute $sql$
      update public.attempts a
      set respostas = coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', aa.id,
            'question_id', aa.question_id,
            'selected_option_id', aa.selected_option_id,
            'correta', aa.correta,
            'tempo_segundos', aa.tempo_segundos,
            'answered_at', aa.answered_at
          ) order by aa.answered_at
        )
        from public.attempt_answers aa
        where aa.attempt_id = a.id
      ), '[]'::jsonb)
      where exists (
        select 1 from public.attempt_answers aa where aa.attempt_id = a.id
      )
    $sql$;
  end if;
end
$migration$;

drop table if exists public.attempt_answers;

commit;
