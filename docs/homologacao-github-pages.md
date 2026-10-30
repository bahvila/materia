# Homologação em materiaedu.com

O frontend React/Vite será publicado no GitHub Pages. O banco, a autenticação e
o Storage continuam no Supabase. O workflow não executa migrations nem altera o DNS.

## 1. Preparar o repositório

Envie estes arquivos ao seu repositório no GitHub. A branch usada pelo workflow é
`Develop`, com D maiúsculo, conforme a branch atual do projeto. Se mudar de branch,
altere tanto `on.push.branches` quanto a condição `deploy.if` no workflow.

Em **Settings → Secrets and variables → Actions → Variables**, crie as
**Repository variables**:

| Nome | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | URL do projeto Supabase de homologação |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública/publishable desse projeto |

Os valores locais estão em `.env.local`. Não envie esse arquivo ao GitHub.
Essas duas configurações são públicas e são incorporadas ao JavaScript no build.
Não use chaves `service_role` ou secret do Supabase nesses campos.

Se usar o mesmo projeto Supabase atual, os testes alterarão os dados desse banco.
Para separar os testes, crie outro projeto e aplique nele as migrations de
`supabase/migrations` antes de usar sua URL e chave.

Em **Settings → Pages → Build and deployment → Source**, selecione
**GitHub Actions**. Se houver regras no environment `github-pages`, permita
deploys da branch `Develop`.

## 2. Configurar o domínio

Você precisa controlar o DNS de `materiaedu.com`; o GitHub não registra o domínio.
Em **Settings → Pages → Custom domain**, informe `materiaedu.com` e salve antes
de apontar o DNS. É recomendado verificar a propriedade do domínio nas
configurações de Pages da conta, seguindo o registro TXT fornecido pelo GitHub.

No provedor de DNS do domínio, configure:

| Tipo | Nome | Destino |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | SEU_USUARIO.github.io |

Substitua `SEU_USUARIO` pelo usuário ou organização dono do repositório, sem
incluir o nome do repositório. Remova apenas registros A/AAAA/CNAME antigos que
conflitem com esses nomes; preserve registros de e-mail como MX e TXT.

Depois que o DNS for validado e o certificado estiver disponível, habilite
**Enforce HTTPS** em Pages. A propagação do DNS pode levar até 24 horas.

O domínio personalizado é necessário para este build, pois os assets usam
caminhos a partir da raiz (`/assets`, `/legacy`). Não use a URL com subpasta
`usuario.github.io/repositorio` como endereço de validação deste deploy.

## 3. Ajustar o login

No Supabase, em **Authentication → URL Configuration**, configure:

- Site URL: `https://materiaedu.com`
- Redirect URLs: `https://materiaedu.com/` e `https://www.materiaedu.com/`
- Preserve também as URLs locais necessárias ao desenvolvimento.

Se criar outro projeto Supabase, configure novamente os provedores de login e
seus callbacks, além de cadastrar um administrador no banco de homologação.

## 4. Publicar

Faça commit e push para `Develop`. Na aba **Actions**, acompanhe o workflow
**Homologacao - GitHub Pages**. Ele instala as dependências, executa lint,
compila e publica `dist` somente se as etapas anteriores passarem.

Para repetir manualmente, use **Actions → Homologacao - GitHub Pages → Run
workflow**, selecionando `Develop`. O workflow precisa existir também na branch
padrão do repositório para que a opção de disparo manual apareça.

Acesse `https://materiaedu.com` e valide login, painel administrativo, leitura de
PDF, filtros, simulados e recarga de links com hash. Cada push em `Develop`
publicará uma nova versão. Para voltar a uma versão anterior, reverta o commit
no Git e envie a reversão para a mesma branch.

## PDFs e arquivos

O Pages serve arquivos estáticos e não executa o Nginx do Docker nem o proxy
`/pdf-origin` do Vite. O Worker externo dos PDFs precisa permitir leitura pelo
domínio `https://materiaedu.com` via CORS. Se a tela de PDF falhar só na
homologação, confira a requisição no navegador e ajuste o Worker; não é necessário
alterar o workflow. Os PDFs não são enviados ao Pages por este processo, a menos
que tenham sido colocados dentro de `public`.

## Referências

- [Workflows do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Domínio personalizado e DNS](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [URLs de redirecionamento do Supabase](https://supabase.com/docs/guides/auth/redirect-urls)
