# Homologação em materiaedu.com

O frontend React/Vite será publicado no GitHub Pages. O banco, a autenticação e
o Storage continuam no Supabase. O workflow não executa migrations nem altera o DNS.

## 1. Preparar o repositório

Envie estes arquivos ao seu repositório no GitHub. A branch usada pelo workflow é
`main`. Se mudar de branch,
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
deploys da branch `main`.

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

O domínio personalizado é opcional. Enquanto configura o DNS, deixe o campo
Custom domain vazio e use `https://bahvila.github.io/materia/`. O workflow
detecta a base do GitHub Pages e adapta os arquivos e rotas para essa subpasta.
Quando ativar `materiaedu.com`, execute o workflow novamente para gerar o build
com a nova base.

## 3. Ajustar o login

No Supabase, em **Authentication → URL Configuration**, configure:

- Site URL: `https://materiaedu.com`
- Redirect URLs: `https://materiaedu.com/` e `https://www.materiaedu.com/`
- Preserve também as URLs locais necessárias ao desenvolvimento.

Enquanto usar o endereço padrão do GitHub, configure Site URL como
`https://bahvila.github.io/materia/` e inclua a URL de retorno
`https://bahvila.github.io/materia/?oauth_popup=google` em Redirect URLs.
Para o domínio próprio, inclua também `https://materiaedu.com/?oauth_popup=google`.

Se criar outro projeto Supabase, configure novamente os provedores de login e
seus callbacks, além de cadastrar um administrador no banco de homologação.

## 4. Publicar

Faça commit na sua branch de trabalho e abra um pull request para `main`. O
workflow valida o build no pull request; após a mesclagem, o push em `main`
publica o site. Também é possível fazer push direto para `main` se as regras
do repositório permitirem. Na aba **Actions**, acompanhe o workflow
**Homologacao - GitHub Pages**. Ele instala as dependências, executa lint,
compila e publica `dist` somente se as etapas anteriores passarem.

Para repetir manualmente, use **Actions → Homologacao - GitHub Pages → Run
workflow**, selecionando `main`. O workflow precisa existir também na branch
padrão do repositório para que a opção de disparo manual apareça.

Acesse `https://materiaedu.com` e valide login, painel administrativo, leitura de
PDF, filtros, simulados e recarga de links com hash. Cada push em `main`
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
