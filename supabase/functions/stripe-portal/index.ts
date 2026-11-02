import { stripe,db,siteUrl,routes,cors,userFor,check } from '../_shared/stripe.ts';
Deno.serve(async req => {
  const headers = { ...cors(req),'Content-Type':'application/json' };
  if (req.method === 'OPTIONS') return new Response('ok',{ headers });
  if (req.method !== 'POST') return new Response('Method not allowed',{ status:405,headers });
  try {
    const user = await userFor(req);
    const { data } = check(await db.from('payment_customers').select('provider_customer_id').eq('user_id',user.id).eq('provider','stripe').single());
    const session = await stripe.billingPortal.sessions.create({ customer:data!.provider_customer_id,configuration:Deno.env.get('STRIPE_PORTAL_CONFIGURATION_ID'),return_url:`${siteUrl()}/#${routes.inicio}` });
    return Response.json({ url:session.url },{ headers });
  } catch { return Response.json({ error:'Não foi possível abrir sua assinatura.' },{ status:400,headers }); }
});
