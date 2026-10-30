# Integração Supabase

Projeto configurado no frontend:

`https://fhalhlfhfpgfxolouisa.supabase.co`

A chave pública fica somente em `.env.local`, que é ignorado pelo Git. O arquivo
`.env.example` documenta os nomes das variáveis sem publicar credenciais do projeto.

## Migration complementar obrigatória

O banco remoto já contém as tabelas principais. Execute no SQL Editor o arquivo:

`supabase/migrations/202610280002_client_access.sql`

Ele adiciona o campo `profiles.metadata` e as autorizações necessárias para:

- catálogo público de apostilas e simulados;
- dados privados do próprio aluno;
- autenticação Supabase;
- operações do painel administrativo;
- acesso a capas, avatares e PDFs autorizados.

Sem essa migration, as tabelas existem, mas o RLS pode retornar listas vazias ou negar
gravações feitas com a chave pública.

## Primeiro administrador

Depois que o usuário se cadastrar no Supabase Auth, crie ou atualize o perfil pelo SQL Editor:

```sql
insert into public.profiles (id, nome, email, tipo_usuario)
select id, coalesce(raw_user_meta_data ->> 'full_name', email), email, 'super_admin'
from auth.users
where lower(email) = lower('SEU_EMAIL@EXEMPLO.COM')
on conflict (id) do update set tipo_usuario = excluded.tipo_usuario;
```

O painel `/admin` só aceita `admin` ou `super_admin`.

## Autenticação

Ative no Supabase Dashboard os provedores utilizados:

- Email/Senha para o painel administrativo;
- Google para alunos;
- Anonymous Sign-Ins para o modo visitante, se desejar mantê-lo.

Configure também as Redirect URLs de desenvolvimento e produção no Supabase Auth.

## Diagnóstico

Com o servidor Vite aberto:

```powershell
npm run audit:supabase
```

O relatório verifica configuração, sessão e acesso às tabelas principais.
