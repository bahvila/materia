# Matéria Education

Aplicação Matéria migrada para React e Vite, preservando fielmente a interface e os comportamentos da versão HTML original.

## Executar

```powershell
npm install
npm run dev
```

Para gerar a versão de produção:

```powershell
npm run build
```

## Supabase

A aplicação usa `@supabase/supabase-js`. Copie `.env.example` para `.env.local` e
preencha a URL e a chave pública do projeto. Nunca coloque uma chave secreta no frontend.

Para testar a conexão com as tabelas:

```powershell
npm run audit:supabase
```

As migrations complementares ficam em `supabase/migrations`.

## Estrutura

- `src/legacy/LegacyPage.jsx`: montagem React das interfaces preservadas.
- `public/legacy`: HTML, CSS e JavaScript extraídos sem alteração da versão original.
- `public/assets`: imagens fornecidas para a marca.
- `legado/html-original-2026-10-27`: versão HTML anterior, preservada integralmente.

## Rotas

- `/inicio` — início
- `/apostila` — apostilas
- `/simulados` — simulados
- `/biblioteca` — biblioteca
- `/admin` — painel administrativo

O arquivo `paineldecontrole.html` foi mantido para redirecionar links antigos para `/admin`.
