import { requireSupabase, supabase } from './supabaseClient'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

class DocumentSnapshot {
  constructor(id, value) {
    this.id = id
    this.value = value
    this.exists = Boolean(value)
  }

  data() {
    return this.value
  }
}

class QuerySnapshot {
  constructor(rows = []) {
    this.docs = rows.map((row) => new DocumentSnapshot(row.id, row.data))
    this.size = this.docs.length
    this.empty = this.docs.length === 0
  }

  forEach(callback) {
    this.docs.forEach(callback)
  }
}

function throwIfError(error) {
  if (error) throw error
}

function centsFromLegacyPrice(value) {
  if (typeof value === 'number') return Math.round(value * 100)
  const normalized = String(value || '0').replace(/\./g, '').replace(',', '.')
  return Math.round((Number.parseFloat(normalized) || 0) * 100)
}

function legacyPriceFromCents(value) {
  return ((value || 0) / 100).toFixed(2).replace('.', ',')
}

function storagePublicUrl(bucket, path) {
  if (!path || /^https?:\/\//i.test(path)) return path || ''
  return requireSupabase().storage.from(bucket).getPublicUrl(path).data.publicUrl
}

async function pdfUrl(path) {
  if (!path || /^https?:\/\//i.test(path)) return path || ''
  const { data } = await requireSupabase().storage.from('apostila-pdfs').createSignedUrl(path, 3600)
  return data?.signedUrl || ''
}

async function apostilaFromRow(row) {
  return {
    id: row.id,
    titulo: row.titulo,
    subtitulo: row.subtitulo || '',
    descricao: row.descricao || '',
    preco: legacyPriceFromCents(row.preco_centavos),
    capaUrl: storagePublicUrl('apostila-capas', row.capa_path),
    pdfUrl: await pdfUrl(row.pdf_path),
    ano: row.ano ? String(row.ano) : '',
    categoria: row.categoria || '',
    tags: row.tags || [],
    ativo: row.status === 'publicado',
    status: row.status,
  }
}

function apostilaToRow(value) {
  const slug = value.slug || String(value.titulo || 'apostila')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return {
    titulo: value.titulo,
    slug,
    subtitulo: value.subtitulo || '',
    descricao: value.descricao || '',
    preco_centavos: centsFromLegacyPrice(value.preco),
    capa_path: value.capaUrl || value.capa_path || '',
    pdf_path: value.pdfUrl || value.pdf_path || '',
    ano: Number.parseInt(value.ano, 10) || null,
    categoria: value.categoria || null,
    tags: value.tags || [],
    status: value.ativo === false ? 'arquivado' : (value.status || 'publicado'),
    updated_at: new Date().toISOString(),
  }
}

function simuladoFromRow(row) {
  const config = row.configuracao || {}
  return {
    id: row.slug || row.id,
    uuid: row.id,
    colecaoQuestoes: row.slug || row.id,
    tituloVisivel: row.titulo,
    descricaoVisivel: row.descricao || '',
    nome: row.descricao ? `${row.titulo}: ${row.descricao}` : row.titulo,
    capaUrl: storagePublicUrl('apostila-capas', row.imagem_path),
    questoes_banca: row.quantidade_questoes || config.questoes_banca || 20,
    tempo_banca: row.duracao_minutos || config.tempo_banca || 60,
    filtros: config.filtros || {},
    ativo: row.status === 'publicado',
    isPremium: row.is_premium,
  }
}

function simuladoToRow(value, documentId) {
  const slug = value.colecaoQuestoes || value.id || documentId
  const titulo = value.tituloVisivel || value.titulo || value.nome?.split(':')[0]?.trim() || slug
  return {
    slug,
    titulo,
    descricao: value.descricaoVisivel || value.descricao || '',
    imagem_path: value.capaUrl || value.imagem_path || '',
    duracao_minutos: value.tempo_banca || value.duracao_minutos || 60,
    quantidade_questoes: value.questoes_banca || value.quantidade_questoes || 20,
    is_premium: value.isPremium || false,
    status: value.ativo === false ? 'arquivado' : 'publicado',
    configuracao: { ...(value.configuracao || {}), filtros: value.filtros || {} },
    updated_at: new Date().toISOString(),
  }
}

function questionFromRow(row) {
  return {
    id: row.id,
    ...(row.metadata || {}),
    Enunciado: row.enunciado,
    Explicacao: row.comentario || row.metadata?.Explicacao || '',
    dificuldade: row.dificuldade || '',
    assunto: row.assunto || '',
    subsecao: row.subsecao || '',
    secao: row.secao || '',
    capitulo: row.capitulo || '',
    modulo: row.modulo || '',
    bloco: row.bloco || '',
  }
}

function questionToRow(value) {
  return {
    enunciado: value.Enunciado || value.enunciado || '',
    comentario: value.Explicacao || value.comentario || '',
    dificuldade: value.dificuldade || null,
    assunto: value.assunto || null,
    subsecao: value.subsecao || null,
    secao: value.secao || null,
    capitulo: value.capitulo || null,
    modulo: value.modulo || null,
    bloco: value.bloco || null,
    status: value.ativo === false ? 'arquivado' : 'publicado',
    metadata: value,
    updated_at: new Date().toISOString(),
  }
}

function couponFromRow(row) {
  return {
    id: row.id,
    codigo: row.codigo,
    tipo: row.tipo,
    valor: row.valor,
    ativoParaObter: row.ativo,
    ativo: row.ativo,
    titulo: row.metadata?.titulo || row.codigo,
    expira: row.valid_until || 'nunca',
    ...(row.metadata || {}),
  }
}

function couponToRow(value, documentId) {
  return {
    codigo: String(value.codigo || documentId || '').toUpperCase(),
    tipo: value.tipo || 'percentual',
    valor: value.valor || 0,
    ativo: value.ativoParaObter ?? value.ativo ?? true,
    valid_from: value.valid_from || null,
    valid_until: value.valid_until || null,
    metadata: value,
    updated_at: new Date().toISOString(),
  }
}

async function profileSnapshot(userId) {
  const client = requireSupabase()
  const [{ data: profile, error }, { data: accesses }, { data: progress }, { data: subscriptions }] = await Promise.all([
    client.from('profiles').select('*').eq('id', userId).maybeSingle(),
    client.from('user_apostilas').select('apostila_id').eq('user_id', userId).is('revoked_at', null),
    client.from('reading_progress').select('apostila_id,pagina_atual').eq('user_id', userId),
    client.from('subscriptions').select('id,status,current_period_end').eq('user_id', userId).eq('status', 'active'),
  ])
  throwIfError(error)
  if (!profile) return null
  const progressoPaginas = Object.fromEntries((progress || []).map((item) => [item.apostila_id, item.pagina_atual]))
  const isPremium = (subscriptions || []).some((item) => !item.current_period_end || new Date(item.current_period_end) > new Date())
  return {
    nome: profile.nome,
    email: profile.email,
    tipoUsuario: profile.tipo_usuario,
    isPremium,
    bibliotecaIds: (accesses || []).map((item) => item.apostila_id),
    simuladosAdicionados: profile.metadata?.simuladosAdicionados || [],
    progressoPaginas,
    cupons: profile.metadata?.cupons || [],
    historico: profile.metadata?.historico || [],
  }
}

async function saveProfile(userId, values, merge = true) {
  const client = requireSupabase()
  const current = merge ? await profileSnapshot(userId) : null
  const metadata = {
    simuladosAdicionados: values.simuladosAdicionados ?? current?.simuladosAdicionados ?? [],
    cupons: values.cupons ?? current?.cupons ?? [],
    historico: values.historico ?? current?.historico ?? [],
  }
  const row = {
    id: userId,
    nome: values.nome ?? current?.nome ?? null,
    email: values.email ?? current?.email ?? null,
    metadata,
    updated_at: new Date().toISOString(),
  }
  const { error } = await client.from('profiles').upsert(row, { onConflict: 'id' })
  throwIfError(error)

  if (values.progressoPaginas) {
    const rows = Object.entries(values.progressoPaginas)
      .filter(([apostilaId]) => UUID_PATTERN.test(apostilaId))
      .map(([apostilaId, pagina]) => ({ user_id: userId, apostila_id: apostilaId, pagina_atual: pagina, last_read_at: new Date().toISOString() }))
    if (rows.length) throwIfError((await client.from('reading_progress').upsert(rows, { onConflict: 'user_id,apostila_id' })).error)
  }
  return row
}

async function findSimulado(identifier) {
  const client = requireSupabase()
  let query = client.from('simulados').select('*')
  query = UUID_PATTERN.test(identifier) ? query.eq('id', identifier) : query.eq('slug', identifier)
  const { data, error } = await query.maybeSingle()
  throwIfError(error)
  return data
}

async function ensureSimulado(identifier) {
  const existing = await findSimulado(identifier)
  if (existing) return existing
  const title = identifier.replace(/^simulado[-_]?/i, '').split(/[-_]/).filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') || 'Simulado'
  const { data, error } = await requireSupabase().from('simulados').insert({
    slug: identifier,
    titulo: title,
    descricao: 'Simulado Completo',
    status: 'publicado',
  }).select('*').single()
  throwIfError(error)
  return data
}

async function listQuestions(collectionName, filters = [], limitValue) {
  const client = requireSupabase()
  let rows = []
  if (collectionName === 'questoes') {
    let query = client.from('questions').select('*')
    for (const [field, operator, value] of filters) {
      if (field === 'simuladoId' && operator === '==') {
        const simulado = await findSimulado(value)
        if (!simulado) return []
        const joined = await client.from('simulado_questions').select('questions(*)').eq('simulado_id', simulado.id)
        throwIfError(joined.error)
        rows = (joined.data || []).map((item) => item.questions)
        return rows.slice(0, limitValue || rows.length).map(questionFromRow)
      }
      query = operator === '==' ? query.eq(field, value) : query
    }
    if (limitValue) query = query.limit(limitValue)
    const result = await query
    throwIfError(result.error)
    rows = result.data || []
  } else {
    const simulado = await findSimulado(collectionName)
    if (!simulado) return []
    let query = client.from('simulado_questions').select('questions(*)').eq('simulado_id', simulado.id).order('ordem')
    if (limitValue) query = query.limit(limitValue)
    const result = await query
    throwIfError(result.error)
    rows = (result.data || []).map((item) => item.questions)
  }
  return rows.map(questionFromRow)
}

class CollectionReference {
  constructor(name, options = {}) {
    this.name = name
    this.filters = options.filters || []
    this.limitValue = options.limitValue || null
    this.order = options.order || null
    this.parentUserId = options.parentUserId || null
  }

  doc(id) {
    return new DocumentReference(this.name, id, { parentUserId: this.parentUserId })
  }

  where(field, operator, value) {
    return new CollectionReference(this.name, { ...this, filters: [...this.filters, [field, operator, value]] })
  }

  limit(value) {
    return new CollectionReference(this.name, { ...this, limitValue: value })
  }

  orderBy(field, direction = 'asc') {
    return new CollectionReference(this.name, { ...this, order: [field, direction] })
  }

  async get() {
    const client = requireSupabase()
    let values = []
    if (this.name === 'apostilas') {
      let query = client.from('apostilas').select('*').order('created_at', { ascending: false })
      if (this.limitValue) query = query.limit(this.limitValue)
      const { data, error } = await query
      throwIfError(error)
      values = await Promise.all((data || []).map(apostilaFromRow))
    } else if (this.name === 'simulados_info') {
      let query = client.from('simulados').select('*').order('created_at', { ascending: false })
      if (this.limitValue) query = query.limit(this.limitValue)
      const { data, error } = await query
      throwIfError(error)
      values = (data || []).map(simuladoFromRow)
    } else if (this.name === 'cupons_sistema') {
      let query = client.from('coupons').select('*').order('created_at', { ascending: false })
      if (this.limitValue) query = query.limit(this.limitValue)
      const { data, error } = await query
      throwIfError(error)
      values = (data || []).map(couponFromRow)
    } else if (this.name === 'historico' && this.parentUserId) {
      const profile = await profileSnapshot(this.parentUserId)
      values = [...(profile?.historico || [])]
      if (this.order?.[0] === 'timestamp') values.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
      values = values.slice(0, this.limitValue || values.length)
    } else {
      values = await listQuestions(this.name, this.filters, this.limitValue)
    }
    return new QuerySnapshot(values.map((value) => ({ id: value.id || crypto.randomUUID(), data: value })))
  }

  async add(value) {
    const client = requireSupabase()
    if (this.name === 'apostilas') {
      const { data, error } = await client.from('apostilas').insert(apostilaToRow(value)).select('id').single()
      throwIfError(error)
      return this.doc(data.id)
    }
    if (this.name === 'historico' && this.parentUserId) {
      const profile = await profileSnapshot(this.parentUserId)
      const record = { id: crypto.randomUUID(), ...value }
      await saveProfile(this.parentUserId, { historico: [record, ...(profile?.historico || [])].slice(0, 50) })
      return this.doc(record.id)
    }
    const simulado = this.name === 'questoes' ? null : await ensureSimulado(this.name)
    const { data, error } = await client.from('questions').insert(questionToRow(value)).select('id').single()
    throwIfError(error)
    if (simulado) {
      throwIfError((await client.from('simulado_questions').insert({ simulado_id: simulado.id, question_id: data.id })).error)
    }
    return this.doc(data.id)
  }
}

class DocumentReference {
  constructor(collectionName, id, options = {}) {
    this.collectionName = collectionName
    this.id = id
    this.parentUserId = options.parentUserId || null
  }

  collection(name) {
    return new CollectionReference(name, { parentUserId: this.id })
  }

  async get() {
    const client = requireSupabase()
    if (this.collectionName === 'usuarios') return new DocumentSnapshot(this.id, await profileSnapshot(this.id))
    if (this.collectionName === 'apostilas') {
      const { data, error } = await client.from('apostilas').select('*').eq('id', this.id).maybeSingle()
      throwIfError(error)
      return new DocumentSnapshot(this.id, data ? await apostilaFromRow(data) : null)
    }
    if (this.collectionName === 'simulados_info') {
      const data = await findSimulado(this.id)
      return new DocumentSnapshot(this.id, data ? simuladoFromRow(data) : null)
    }
    if (this.collectionName === 'cupons_sistema') {
      const { data, error } = await client.from('coupons').select('*').eq('codigo', this.id.toUpperCase()).maybeSingle()
      throwIfError(error)
      return new DocumentSnapshot(data?.id || this.id, data ? couponFromRow(data) : null)
    }
    const { data, error } = await client.from('questions').select('*').eq('id', this.id).maybeSingle()
    throwIfError(error)
    return new DocumentSnapshot(this.id, data ? questionFromRow(data) : null)
  }

  async set(value, options = {}) {
    const client = requireSupabase()
    if (this.collectionName === 'usuarios') return saveProfile(this.id, value, options.merge)
    if (this.collectionName === 'simulados_info') {
      const existing = await findSimulado(this.id)
      const row = simuladoToRow(value, this.id)
      if (existing) row.id = existing.id
      const { error } = await client.from('simulados').upsert(row, { onConflict: existing ? 'id' : 'slug' })
      throwIfError(error)
      return
    }
    if (this.collectionName === 'cupons_sistema') {
      const { error } = await client.from('coupons').upsert(couponToRow(value, this.id), { onConflict: 'codigo' })
      throwIfError(error)
      return
    }
    const table = this.collectionName === 'apostilas' ? 'apostilas' : 'questions'
    const mapper = table === 'apostilas' ? apostilaToRow : questionToRow
    const { error } = await client.from(table).upsert({ id: this.id, ...mapper(value) })
    throwIfError(error)
  }

  async update(value) {
    const current = await this.get()
    if (!current.exists) throw new Error(`Registro não encontrado: ${this.id}`)
    return this.set({ ...current.data(), ...value }, { merge: true })
  }

  async delete() {
    const client = requireSupabase()
    const table = this.collectionName === 'apostilas' ? 'apostilas'
      : this.collectionName === 'simulados_info' ? 'simulados'
        : this.collectionName === 'cupons_sistema' ? 'coupons' : 'questions'
    const field = this.collectionName === 'simulados_info' ? (UUID_PATTERN.test(this.id) ? 'id' : 'slug')
      : this.collectionName === 'cupons_sistema' ? 'codigo' : 'id'
    const { error } = await client.from(table).delete().eq(field, field === 'codigo' ? this.id.toUpperCase() : this.id)
    throwIfError(error)
  }
}

function mapAuthUser(user) {
  if (!user) return null
  return {
    ...user,
    uid: user.id,
    displayName: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || null,
  }
}

function createAuthAdapter() {
  const client = requireSupabase()
  const adapter = {
    currentUser: null,
    async signInWithPopup() {
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href },
      })
      throwIfError(error)
      return data
    },
    async signInAnonymously() {
      const { data, error } = await client.auth.signInAnonymously()
      throwIfError(error)
      return data
    },
    async signInWithEmailAndPassword(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password })
      throwIfError(error)
      return data
    },
    async signOut() {
      const { error } = await client.auth.signOut()
      throwIfError(error)
    },
    onAuthStateChanged(callback) {
      client.auth.getUser().then(({ data }) => {
        adapter.currentUser = mapAuthUser(data.user)
        callback(adapter.currentUser)
      })
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        adapter.currentUser = mapAuthUser(session?.user)
        callback(adapter.currentUser)
      })
      return () => data.subscription.unsubscribe()
    },
  }
  return adapter
}

export function installSupabaseFirebaseAdapter() {
  if (!supabase) return false
  const authAdapter = createAuthAdapter()
  const options = { projectId: new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0], provider: 'supabase' }
  function auth() { return authAdapter }
  auth.GoogleAuthProvider = class GoogleAuthProvider {}
  window.firebase = {
    initializeApp: () => window.firebase,
    app: () => ({ options }),
    firestore: Object.assign(() => ({ collection: (name) => new CollectionReference(name) }), {
      FieldValue: { serverTimestamp: () => new Date().toISOString() },
    }),
    auth,
  }
  window.supabase = supabase
  return true
}

