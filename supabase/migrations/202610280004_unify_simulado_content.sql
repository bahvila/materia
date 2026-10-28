-- Unifica a configuração e as questões de cada simulado em public.simulados.
-- Preserva questões existentes no campo JSONB antes de remover as tabelas antigas.

begin;

alter table public.simulados
  add column if not exists questoes jsonb not null default '[]'::jsonb;

do $migration$
declare
  orphan_questions bigint;
begin
  if to_regclass('public.simulado_questions') is not null
     and to_regclass('public.questions') is not null
     and to_regclass('public.question_options') is not null then
    execute $sql$
      select count(*)
      from public.questions q
      where not exists (
        select 1 from public.simulado_questions sq where sq.question_id = q.id
      )
    $sql$ into orphan_questions;

    if orphan_questions > 0 then
      raise exception 'Migração cancelada: % questão(ões) não pertencem a nenhum simulado.', orphan_questions;
    end if;

    execute $sql$
update public.simulados s
set questoes = coalesce((
  select jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'enunciado', q.enunciado,
      'comentario', q.comentario,
      'dificuldade', q.dificuldade,
      'assunto', q.assunto,
      'subsecao', q.subsecao,
      'secao', q.secao,
      'capitulo', q.capitulo,
      'modulo', q.modulo,
      'bloco', q.bloco,
      'status', q.status,
      'metadata', q.metadata,
      'opcoes', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', qo.id,
            'letra', qo.letra,
            'texto', qo.texto,
            'correta', qo.correta,
            'ordem', qo.ordem
          ) order by qo.ordem
        )
        from public.question_options qo
        where qo.question_id = q.id
      ), '[]'::jsonb)
    ) order by sq.ordem nulls last, sq.created_at
  )
  from public.simulado_questions sq
  join public.questions q on q.id = sq.question_id
  where sq.simulado_id = s.id
), '[]'::jsonb)
where exists (
  select 1 from public.simulado_questions sq where sq.simulado_id = s.id
)
    $sql$;
  end if;
end
$migration$;

alter table public.attempt_answers
  drop constraint if exists attempt_answers_question_id_fkey,
  drop constraint if exists attempt_answers_selected_option_id_fkey;

drop table if exists public.simulado_questions;
drop table if exists public.question_options;
drop table if exists public.questions;

commit;
