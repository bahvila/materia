import { stripe, db, siteUrl, routes, cors, userFor, check } from '../_shared/stripe.ts';

Deno.serve(async req => {
  const headers = { ...cors(req), 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers });
  try {
    const user = await userFor(req);
    const { tipo, contentId } = await req.json();
    if (!['premium','apostila','simulado'].includes(tipo)) throw new Error('Produto inválido.');
    const table = tipo === 'premium' ? 'plans' : tipo === 'apostila' ? 'apostilas' : 'simulados';
    let query = db.from(table).select('*');
    query = tipo === 'premium' ? query.eq('slug','materia-premium').eq('ativo',true) : query.eq('id',contentId).eq('status','publicado');
    const { data: product } = check(await query.single());
    if (!product || !Number.isInteger(product.preco_centavos) || product.preco_centavos <= 0) throw new Error('Este conteúdo ainda não tem preço configurado.');
    if (tipo !== 'premium') {
      let access = db.from(tipo === 'apostila' ? 'user_apostilas' : 'user_simulados').select('*').eq('user_id',user.id).eq(tipo === 'apostila' ? 'apostila_id' : 'simulado_id',product.id).is('revoked_at',null);
      if (tipo === 'apostila') access = access.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
      const { data: owned } = check(await access.limit(1));
      if (owned?.length) throw new Error('Você já tem acesso a este conteúdo. Atualize a página.');
    }
    if (tipo === 'premium') {
      const { data: active } = check(await db.from('subscriptions').select('id').eq('user_id',user.id).eq('plan_id',product.id).in('status',['active','trialing']).gt('current_period_end',new Date().toISOString()).limit(1));
      if (active?.length) throw new Error('Você já tem Premium. Use Gerenciar assinatura.');
    }
    const { data: existing } = check(await db.from('payment_customers').select('provider_customer_id').eq('user_id',user.id).eq('provider','stripe').maybeSingle());
    let customerId = existing?.provider_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { user_id: user.id, application: 'materia' } }, { idempotencyKey: `materia-customer-${user.id}` });
      customerId = customer.id;
      check(await db.from('payment_customers').upsert({ user_id: user.id, provider: 'stripe', provider_customer_id: customerId }, { onConflict:'user_id,provider' }));
    }
    const { data: order } = check(await db.from('stripe_checkout_orders').insert({ user_id:user.id,tipo,total_centavos:product.preco_centavos,currency:'brl',
      ...(tipo === 'premium' ? { plan_id:product.id } : tipo === 'apostila' ? { apostila_id:product.id } : { simulado_id:product.id }) }).select('id').single());
    const session = await stripe.checkout.sessions.create({
      mode: tipo === 'premium' ? 'subscription' : 'payment', customer: customerId, client_reference_id:user.id,
      success_url:`${siteUrl()}/?checkout=success&session_id={CHECKOUT_SESSION_ID}#${routes.biblioteca}`, cancel_url:`${siteUrl()}/?checkout=canceled#${tipo === 'simulado' ? routes.simulados : routes.apostila}`,
      metadata:{ order_id:order!.id, application:'materia' }, payment_method_types:['card'],
      ...(tipo === 'premium' ? { subscription_data:{ metadata:{ application:'materia',user_id:user.id,plan_id:product.id } } } : {}),
      line_items:[{ quantity:1, price_data:{ currency:'brl',unit_amount:product.preco_centavos,product_data:{ name:product.nome || product.titulo },
        ...(tipo === 'premium' ? { recurring:{ interval:'month' as const } } : {}) } }],
    }, { idempotencyKey:`materia-checkout-${order!.id}` });
    check(await db.from('stripe_checkout_orders').update({ checkout_session_id:session.id }).eq('id',order!.id));
    return Response.json({ url:session.url }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível iniciar o pagamento.' }, { status:400,headers });
  }
});
