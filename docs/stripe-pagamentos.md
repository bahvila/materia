# Pagamentos Stripe

O checkout é hospedado pelo Stripe. O frontend usa a URL da sessão; não precisa
da chave publicável nem do SDK Stripe.js. A chave secreta e a assinatura do webhook
ficam em secrets das Edge Functions, nunca em variáveis `VITE_*`.

## Regras de acesso

- Premium mensal: R$ 24,99, conforme o plano `materia-premium` em `plans`.
  Assinaturas `active` ou `trialing`, com período vigente, liberam todas as apostilas
  e simulados. Cancelamento ao final do período mantém acesso até o vencimento.
- Compra avulsa: o preço vem de `apostilas.preco_centavos` ou
  `simulados.preco_centavos`; valores enviados pelo navegador não são aceitos.
  Simulados sem preço ficam disponíveis somente para assinantes.
- Somente o webhook assinado confirma o pagamento. Retornar à URL de sucesso
  apenas atualiza a interface; não concede acesso.
- Reembolso integral de compra avulsa revoga o item. Reembolso parcial mantém
  acesso. Reembolsar uma mensalidade não cancela automaticamente a assinatura;
  o cancelamento deve ser feito no Stripe ou pelo portal do cliente.
- Questões e localização dos PDFs não podem ser consultadas diretamente pelo
  catálogo público. RPCs conferem acesso no servidor. Alterar `metadata` do perfil
  não concede Premium nem libera conteúdos.
- Administradores conservam acesso para gerenciar conteúdo.
- Cupons antigos salvos apenas no navegador/perfil não concedem direitos. O
  resgate local foi desativado; descontos precisam de validação no servidor.

## Arquivos PDF

Envie PDFs completos ao bucket **privado** `apostila-pdfs`. No cadastro da apostila,
informe o caminho do objeto, por exemplo `apostilas/administracao.pdf`, sem URL pública.
O leitor solicita uma URL temporária apenas após verificar o direito de acesso.
URLs já emitidas permanecem válidas por até uma hora.

A amostra precisa ser um **arquivo separado**, contendo apenas as páginas gratuitas.
Cadastre o caminho em `preview_pdf_path`. Limitar páginas no navegador não protege
um PDF completo. Sem arquivo de amostra, o leitor informa que ela não está disponível.

## Configuração do backend

Arquivo local ignorado pelo Git: `supabase/.env.stripe.local`.

```dotenv
STRIPE_SECRET_KEY=sk_test_SUBSTITUIR
STRIPE_WEBHOOK_SECRET=whsec_SUBSTITUIR
STRIPE_PORTAL_CONFIGURATION_ID=bpc_SUBSTITUIR
SITE_URL=https://materiaedu.com
ALLOWED_ORIGINS=https://materiaedu.com,https://www.materiaedu.com,http://localhost:5173,http://127.0.0.1:5173
```

`SITE_URL` define o destino após pagar ou cancelar. Para testar o retorno ao servidor
local, altere-o temporariamente para `http://localhost:5173` e atualize os secrets.
Em produção, use exclusivamente o endereço público. Os métodos habilitados nesta
integração são cartões; PIX não é anunciado como disponível.

```powershell
node scripts/provision-stripe-test.mjs
npx supabase secrets set --env-file supabase/.env.stripe.local
npx supabase functions deploy stripe-checkout stripe-webhook stripe-portal --use-api
```

O provisionamento aceita somente chaves de teste e configura o webhook e o portal
de cancelamento no fim do período. As funções de checkout e portal validam o usuário
com `auth.getUser`. O webhook valida a assinatura Stripe sobre o corpo original.
Por isso, as três funções usam `verify_jwt = false`; nenhuma dispensa sua própria autenticação.

A migration `202611020001_stripe_access.sql` cria permissões, pedidos e direitos de
acesso. Ao instalar em outro projeto, aplique as migrations revisadas com o CLI.
No projeto conectado nesta implementação, havia uma promoção de administrador
antiga fora de ordem (`202610300002`). Apenas a migration Stripe foi aplicada e
registrada em uma transação; a promoção não foi executada.

## Validação

```powershell
npm run test:payments
npm run check
npx deno check --no-lock --node-modules-dir=auto supabase/functions/stripe-checkout/index.ts supabase/functions/stripe-webhook/index.ts supabase/functions/stripe-portal/index.ts
```

Os testes SQL executam PostgreSQL isolado via PGlite e cobrem consultas públicas,
conteúdo protegido, tentativas de concessão pelo cliente, compra por item,
isolamento entre usuários, repetição de webhook, reembolso, Premium e vencimento.

`node scripts/verify-stripe-deployment.mjs` verifica os endpoints publicados usando
apenas a chave pública Supabase e a assinatura do webhook Stripe: catálogo público,
colunas protegidas, exigência de login e rejeição de eventos não assinados. Um
evento assinado que aponta para uma sessão inexistente precisa retornar erro para
ser repetido, sem conceder acesso. Nenhum pagamento é efetuado por esse teste.

Antes de usar dinheiro real, configure credenciais e webhook do ambiente live,
confira preços e métodos, publique o frontend atualizado e faça uma compra de
homologação. O frontend antigo ainda usa consultas de conteúdo incompatíveis
com as novas permissões.

Referências: [liberação pelo Checkout](https://docs.stripe.com/checkout/fulfillment),
[ciclo da assinatura](https://docs.stripe.com/billing/subscriptions/webhooks),
[webhooks em Edge Functions](https://supabase.com/docs/guides/functions/examples/stripe-webhooks).
