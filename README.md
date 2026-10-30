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

## Docker

Para publicar a homologação no GitHub Pages com `materiaedu.com`, siga o
[guia de homologação](docs/homologacao-github-pages.md). O workflow está em
`.github/workflows/homologacao-pages.yml` e publica a branch `Develop`.

Com o Docker Desktop iniciado e configurado para contêineres Linux, preencha
`.env.local` usando `.env.example` como referência e execute:

```powershell
docker compose --env-file .env.local up -d --build
```

Abra http://localhost:8080. Para usar outra porta, adicione `APP_PORT=8081` ao
`.env.local` antes de executar o comando.

A imagem compila o frontend com Node e serve os arquivos com Nginx. As rotas
React funcionam ao atualizar a página, e `/pdf-origin/` encaminha os PDFs ao
mesmo serviço configurado no Vite. O Supabase continua externo; este Compose
não cria um banco local.

As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` são incorporadas
ao frontend durante o build. Use somente a chave pública. Após alterar essas
variáveis ou o código, execute novamente o comando com `--build`. Arquivos
`.env*` ficam fora do contexto enviado ao Docker.

Para consultar o estado e os logs ou parar a aplicação:

```powershell
docker compose --env-file .env.local ps
docker compose --env-file .env.local logs -f web
docker compose --env-file .env.local down
```

Referência: [build com argumentos no Docker Compose](https://docs.docker.com/reference/compose-file/build/).

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
