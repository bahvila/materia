begin;

create function public.filter_simulado_questions(questions jsonb, filters jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(question order by position), '[]'::jsonb)
  from jsonb_array_elements(questions) with ordinality as q(question, position)
  where not exists (
    select 1
    from jsonb_each_text(case when jsonb_typeof(filters) = 'object' then filters else '{}'::jsonb end) as f(field, value)
    where field in ('dificuldade', 'assunto', 'subsecao', 'secao', 'capitulo', 'modulo', 'bloco')
      and nullif(btrim(value), '') is not null
      and coalesce(nullif(btrim(question->>field), ''), btrim(question->'metadata'->>field))
          is distinct from btrim(value)
  );
$$;

create function public.count_filtered_simulado_questions()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.quantidade_questoes := jsonb_array_length(
    public.filter_simulado_questions(new.questoes, new.configuracao->'filtros')
  );
  return new;
end;
$$;

create trigger count_filtered_simulado_questions
before insert or update of questoes, configuracao, quantidade_questoes on public.simulados
for each row execute function public.count_filtered_simulado_questions();

update public.simulados
set quantidade_questoes = jsonb_array_length(public.filter_simulado_questions(questoes, configuracao->'filtros'))
where quantidade_questoes is distinct from
  jsonb_array_length(public.filter_simulado_questions(questoes, configuracao->'filtros'));

create function public.get_simulado_question_bank(simulado_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;
  return (select questoes from public.simulados where id = simulado_id);
end;
$$;
revoke all on function public.get_simulado_question_bank(uuid) from public;
grant execute on function public.get_simulado_question_bank(uuid) to authenticated;

create or replace function public.get_simulado_questions(identifier text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare item public.simulados;
begin
  select * into item from public.simulados where id::text = identifier or slug = identifier limit 1;
  if item.id is null or (item.status <> 'publicado' and not public.is_admin()) then
    raise exception 'Simulado indisponível';
  end if;
  if not public.can_access_simulado(item.id) then
    raise exception 'Adquira este simulado ou assine o Premium' using errcode = '42501';
  end if;
  return public.filter_simulado_questions(item.questoes, item.configuracao->'filtros');
end;
$$;

insert into public.plans (nome, slug, preco_centavos, moeda, intervalo, intervalo_quantidade, recursos)
select 'Matéria Premium Semestral', 'materia-premium-semestral', 9999, moeda, 'month', 6, recursos
from public.plans where slug = 'materia-premium'
on conflict (slug) do nothing;

create or replace function public.has_premium_access() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subscriptions s join public.plans p on p.id = s.plan_id
    where s.user_id = auth.uid()
      and p.slug in ('materia-premium', 'materia-premium-semestral')
      and s.status in ('active', 'trialing') and s.current_period_end > now()
  );
$$;

commit;
