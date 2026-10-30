// Supabase é exposto pela camada de compatibilidade carregada pelo React.
        firebase.initializeApp({ provider: "supabase" });
        const db = firebase.firestore();
        const auth = firebase.auth();
        const adminSections = ['apostilas', 'simulados', 'cupons', 'tags'];
        let tagsAdmin = [];
        let conteudosTagsAdmin = [];
        let carregamentoTagsAdmin = 0;

        function validarCamposObrigatorios(campos) {
            const vazios = campos.filter(([id]) => {
                const campo = document.getElementById(id);
                const vazio = campo.type === 'file' ? !campo.files.length : !campo.value.trim();
                campo.setAttribute('aria-required', 'true');
                if (vazio) campo.setAttribute('aria-invalid', 'true');
                else campo.removeAttribute('aria-invalid');
                if (!campo.dataset.validacaoObrigatoria) {
                    const limparErro = () => {
                        const preenchido = campo.type === 'file' ? campo.files.length > 0 : Boolean(campo.value.trim());
                        if (preenchido) campo.removeAttribute('aria-invalid');
                    };
                    campo.addEventListener('input', limparErro);
                    campo.addEventListener('change', limparErro);
                    campo.dataset.validacaoObrigatoria = 'true';
                }
                return vazio;
            });
            if (!vazios.length) return true;
            mostrarToast('warning', `Preencha os campos obrigatórios: ${vazios.map(([, nome]) => nome).join(', ')}.`, { title: 'Campos não preenchidos' });
            document.getElementById(vazios[0][0]).focus();
            return false;
        }

        function definirStatus(id, mensagem = '', tipo = 'success') {
            const element = document.getElementById(id);
            if (!element) return;
            element.textContent = mensagem;
            element.dataset.statusType = tipo;
        }

        function sincronizarPortal(tipo) {
            try {
                if (tipo === 'apostilas') window.parent.carregarApostilasDoFirebase?.();
                if (tipo === 'simulados') window.parent.carregarSimuladosDoFirebase?.();
            } catch (error) {
                console.warn('Não foi possível sincronizar o catálogo do portal:', error);
            }
        }

        function secaoAdminAtual() {
            try {
                const parentMatch = (window.parent.portalCurrentRoute?.() || window.parent.location.pathname).match(/^\/administrador\/(apostilas|simulados|cupons|tags)/);
                if (parentMatch) return parentMatch[1];
            } catch (_) { /* iframe isolado: usa a query local */ }
            const querySection = new URLSearchParams((window.portalCurrentRoute?.() || window.location.search).split('?').pop()).get('section');
            return adminSections.includes(querySection) ? querySection : 'apostilas';
        }

        function navegarAdmin(section, updateAddress = true) {
            const target = adminSections.includes(section) ? section : 'apostilas';
            document.querySelectorAll('.admin-page').forEach(page => page.classList.remove('active'));
            document.querySelectorAll('.admin-nav-button').forEach(button => button.classList.toggle('active', button.dataset.adminSection === target));
            document.getElementById(`admin-page-${target}`)?.classList.add('active');
            if (target === 'tags') carregarTagsAdmin();
            if (target === 'apostilas') carregarTagsFormularioAdmin('apostila');
            if (target === 'simulados') carregarTagsFormularioAdmin('simulado');
            if (updateAddress && window.parent === window) {
                window.history.pushState({}, '', window.portalRouteUrl(`/admin?section=${target}`));
            } else if (updateAddress) {
                try {
                    window.parent.history.pushState({ separador: 'administrador', adminSection: target }, '', window.parent.portalRouteUrl(`/administrador/${target}`));
                    window.parent.document.title = `${target.charAt(0).toUpperCase() + target.slice(1)} | Administrador | Matéria`;
                } catch (_) {
                    window.history.pushState({}, '', window.portalRouteUrl(`/admin?section=${target}`));
                }
            }
        }

        function fazerLoginAdmin() {
            if (!validarCamposObrigatorios([['adm-login-email', 'E-mail'], ['adm-login-senha', 'Senha']])) return;
            const email = document.getElementById('adm-login-email').value.trim();
            const senha = document.getElementById('adm-login-senha').value;
            if (!email || !senha) {
                mostrarToast('warning', 'Preencha o e-mail e a senha de administrador.', { title: 'Dados obrigatórios' });
                return;
            }
            auth.signInWithEmailAndPassword(email, senha)
                .then(() => {
                    document.getElementById('adm-login-senha').value = "";
                    mostrarToast('success', 'Autenticação concluída. Validando suas permissões.', { title: 'Login realizado' });
                })
                .catch(err => {
                    mostrarToast('error', `Verifique seu e-mail e senha. ${err.message || ''}`.trim(), { title: 'Erro ao autenticar' });
                });
        }

        function fazerLogoutAdmin() {
            auth.signOut()
                .then(() => mostrarToast('info', 'A sessão administrativa foi encerrada.', { title: 'Você saiu da conta' }))
                .catch(error => mostrarToast('error', error.message, { title: 'Erro ao encerrar sessão' }));
        }

        auth.onAuthStateChanged(async user => {
            const boxLogin = document.getElementById('box-login-admin');
            const boxLogado = document.getElementById('box-logado-admin');
            if (user) {
                const { data: perfil, error } = await window.supabase
                    .from('profiles')
                    .select('tipo_usuario')
                    .eq('id', user.uid)
                    .maybeSingle();
                const autorizado = !error && ['admin', 'super_admin'].includes(perfil?.tipo_usuario);
                if (!autorizado) {
                    boxLogin.style.display = 'none';
                    boxLogado.style.display = 'none';
                    document.querySelector('main').innerHTML = `
                        <section class="admin-access-denied">
                            <span>Área restrita</span>
                            <h2>Acesso administrativo não autorizado</h2>
                            <p>${error ? 'Não foi possível confirmar sua permissão agora.' : 'Sua conta continua conectada, mas não possui perfil de administrador.'}</p>
                        </section>`;
                    mostrarToast('error', error ? 'Não foi possível confirmar sua permissão.' : 'Sua conta não possui acesso administrativo.', { title: 'Acesso não autorizado' });
                    return;
                }
                boxLogin.style.display = 'none';
                boxLogado.style.display = 'flex';
                document.getElementById('label-email-admin').innerText = user.email;
                carregarListasAdmin();
                carregarCuponsNoAdmin();
                carregarTagsAdmin();
                carregarTagsFormularioAdmin('apostila');
                carregarTagsFormularioAdmin('simulado');
            } else {
                boxLogin.style.display = 'flex';
                boxLogado.style.display = 'none';
            }
        });

        async function salvarApostila() {
            if (!validarCamposObrigatorios([
                ['adm-ap-tags', 'Tag da apostila'],
                ['adm-ap-titulo', 'Título da apostila'],
                ['adm-ap-sub', 'Subtítulo'],
                ['adm-ap-preco', 'Preço'],
                ['adm-ap-capa', 'URL da capa'],
                ['adm-ap-pdf', 'URL do PDF'],
                ['adm-ap-desc', 'Descrição'],
            ])) return;
            const nova = {
                tags: [...document.getElementById('adm-ap-tags').selectedOptions].map(option => option.value),
                titulo: document.getElementById('adm-ap-titulo').value.trim(),
                subtitulo: document.getElementById('adm-ap-sub').value.trim(),
                preco: document.getElementById('adm-ap-preco').value.trim(),
                capaUrl: document.getElementById('adm-ap-capa').value.trim(),
                pdfUrl: document.getElementById('adm-ap-pdf').value.trim(),
                descricao: document.getElementById('adm-ap-desc').value.trim(),
                ano: "2026",
                ativo: true
            };
            if (!nova.titulo) { mostrarToast('warning', 'Preencha o título da apostila.', { title: 'Título obrigatório' }); return; }

            try {
                await db.collection("apostilas").add(nova);
                definirStatus('status-ap', 'Apostila publicada com sucesso.');
                mostrarToast('success', `A apostila “${nova.titulo}” foi criada e publicada.`, { title: 'Apostila criada' });
                await carregarListasAdmin();
                sincronizarPortal('apostilas');
            } catch (e) {
                mostrarToast('error', e.message || 'Não foi possível salvar a apostila.', { title: 'Erro ao criar apostila' });
            }
        }

const camposTaxonomia = ['dificuldade', 'assunto', 'subsecao', 'secao', 'capitulo', 'modulo', 'bloco'];

        function gerarSlug(texto) {
            return String(texto || '')
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        }

        function preencherFiltrosQuestoes(questoes = [], filtrosSalvos = {}) {
            const valores = Object.fromEntries(camposTaxonomia.map(campo => [campo, new Set()]));
            questoes.forEach(questao => camposTaxonomia.forEach(campo => {
                const valor = questao[campo] || questao.metadata?.[campo];
                if (String(valor || '').trim()) valores[campo].add(String(valor).trim());
            }));
            camposTaxonomia.forEach(campo => {
                const select = document.getElementById(`filtro-col-${campo}`);
                const opcoes = [...valores[campo]].sort();
                select.innerHTML = `<option value="">Todos (${opcoes.length})</option>` + opcoes
                    .map(valor => `<option value="${valor}" ${valor === filtrosSalvos[campo] ? 'selected' : ''}>${valor}</option>`).join('');
            });
        }

        function novoSimulado() {
            [...document.getElementById('adm-sim-tags').options].forEach(option => { option.selected = false; });
            document.getElementById('adm-sim-id').value = '';
            document.getElementById('adm-sim-titulo').value = '';
            document.getElementById('adm-sim-slug').value = '';
            document.getElementById('adm-sim-desc').value = '';
            document.getElementById('adm-sim-capa').value = '';
            document.getElementById('adm-sim-qtd').value = '0';
            document.getElementById('adm-sim-tempo').value = '60';
            document.getElementById('adm-sim-status').value = 'rascunho';
            preencherFiltrosQuestoes();
            definirStatus('status-sim');
            document.getElementById('adm-sim-titulo').focus();
        }

        document.getElementById('adm-sim-titulo')?.addEventListener('input', event => {
            if (!document.getElementById('adm-sim-id').value) {
                document.getElementById('adm-sim-slug').value = gerarSlug(event.target.value);
            }
        });

        async function salvarConfigSimulado() {
            if (!validarCamposObrigatorios([
                ['adm-sim-tags', 'Tag do simulado'],
                ['adm-sim-titulo', 'Título do simulado'],
                ['adm-sim-desc', 'Descrição'],
                ['adm-sim-capa', 'URL da capa'],
                ['adm-sim-tempo', 'Tempo (min)'],
                ['adm-sim-status', 'Status'],
            ])) return;
            const id = document.getElementById('adm-sim-id').value;
            const titulo = document.getElementById('adm-sim-titulo').value.trim();
            const slug = document.getElementById('adm-sim-slug').value.trim() || gerarSlug(titulo);
            if (!titulo || !slug) return mostrarToast('warning', 'Informe o título do simulado.', { title: 'Título obrigatório' });

            const filtros = {};
            camposTaxonomia.forEach(campo => {
                const valor = document.getElementById(`filtro-col-${campo}`).value;
                if (valor) filtros[campo] = valor;
            });
            const row = {
                tags: [...document.getElementById('adm-sim-tags').selectedOptions].map(option => option.value),
                titulo,
                slug,
                descricao: document.getElementById('adm-sim-desc').value.trim(),
                imagem_path: document.getElementById('adm-sim-capa').value.trim(),
                duracao_minutos: Number(document.getElementById('adm-sim-tempo').value) || 60,
                status: document.getElementById('adm-sim-status').value,
                configuracao: { filtros },
                published_at: document.getElementById('adm-sim-status').value === 'publicado' ? new Date().toISOString() : null,
                updated_at: new Date().toISOString(),
            };
            const query = id
                ? window.supabase.from('simulados').update(row).eq('id', id).select('id').single()
                : window.supabase.from('simulados').insert(row).select('id').single();
            const { data, error } = await query;
            if (error) return mostrarToast('error', error.message, { title: 'Erro ao salvar simulado' });
            document.getElementById('adm-sim-id').value = data.id;
            definirStatus('status-sim', 'Simulado salvo com sucesso.');
            mostrarToast('success', `O simulado “${titulo}” foi ${id ? 'atualizado' : 'criado'} com sucesso.`, { title: id ? 'Simulado atualizado' : 'Simulado criado' });
            await carregarListasAdmin();
            sincronizarPortal('simulados');
        }

        async function editarSimuladoNaCaixa(id) {
            const { data, error } = await window.supabase.from('simulados').select('*').eq('id', id).single();
            if (error) return mostrarToast('error', error.message, { title: 'Erro ao carregar simulado' });
            await carregarTagsFormularioAdmin('simulado', data.tags || []);
            document.getElementById('adm-sim-id').value = data.id;
            document.getElementById('adm-sim-titulo').value = data.titulo;
            document.getElementById('adm-sim-slug').value = data.slug;
            document.getElementById('adm-sim-desc').value = data.descricao || '';
            document.getElementById('adm-sim-capa').value = data.imagem_path || '';
            document.getElementById('adm-sim-qtd').value = (data.questoes || []).length;
            document.getElementById('adm-sim-tempo').value = data.duracao_minutos || 60;
            document.getElementById('adm-sim-status').value = data.status || 'rascunho';
            preencherFiltrosQuestoes(data.questoes || [], data.configuracao?.filtros || {});
            document.getElementById('adm-csv-simid').value = data.id;
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        async function carregarListasAdmin() {
            const divAp = document.getElementById('lista-admin-apostilas');
            const divSim = document.getElementById('lista-admin-simulados');

            // 1. Listar Apostilas
            const snapAp = await db.collection("apostilas").get();
            if (snapAp.empty) {
                divAp.innerHTML = "<p style='color:#777;'>Nenhuma apostila cadastrada.</p>";
            } else {
                divAp.innerHTML = snapAp.docs.map(doc => {
                    const d = doc.data();
                    const visivel = d.ativo !== false;
                    return `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border:1px solid #ddd; border-radius:8px; margin-bottom:8px; background:${visivel ? '#fff' : '#f5f5f5'};">
                        <div>
                            <strong>${d.titulo}</strong><br>
                            <span style="font-size:11px; color:${visivel ? '#2E6F40' : '#C9302C'}; font-weight:700;">
                                ${visivel ? '● Visível no Site' : '○ Oculto no Site'}
                            </span>
                        </div>
                        <div style="display:flex; gap:6px;">
                            <button onclick="alternarVisibilidade('apostilas', '${doc.id}', ${visivel})" style="padding:6px 10px; border-radius:6px; border:1px solid #888; cursor:pointer; font-weight:700; font-size:12px;">
                                ${visivel ? 'Ocultar' : 'Mostrar'}
                            </button>
                            <button onclick="excluirItemBanco('apostilas', '${doc.id}')" style="padding:6px 10px; border-radius:6px; border:none; background:#C9302C; color:#fff; cursor:pointer; font-weight:700; font-size:12px;">
                                Excluir
                            </button>
                        </div>
                    </div>`;
                }).join('');
            }

            // 2. Simulados são uma única tabela; as questões ficam no JSONB `questoes`.
            const { data: simulados, error: erroSimulados } = await window.supabase
                .from('simulados').select('id,slug,titulo,descricao,status,questoes,configuracao').order('created_at', { ascending: false });
            if (erroSimulados) {
                divSim.innerHTML = `<p style="color:#C9302C;">${erroSimulados.message}</p>`;
            } else if (!simulados.length) {
                divSim.innerHTML = "<p style='color:#777;'>Nenhum simulado cadastrado. Use o formulário acima para criar o primeiro.</p>";
            } else {
                divSim.innerHTML = simulados.map(simulado => {
                    const publicado = simulado.status === 'publicado';
                    const filtros = simulado.configuracao?.filtros || {};
                    const filtrosAtivos = Object.entries(filtros).map(([campo, valor]) => `${campo}: ${valor}`).join(' | ');
                    return `
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px; border:1px solid #ddd; border-radius:8px; margin-bottom:8px; background:${publicado ? '#fff' : '#f5f5f5'};">
                        <div>
                            <span style="font-size:10px; background:#EBEBEB; padding:2px 6px; border-radius:4px; font-weight:700;">/${simulado.slug}</span><br>
                            <strong style="font-size:15px;">${simulado.titulo}</strong>${simulado.descricao ? ` <span style="color:#555;">— ${simulado.descricao}</span>` : ''}<br>
                            <span style="font-size:11px; color:#555;">${(simulado.questoes || []).length} questões</span>${filtrosAtivos ? ` · <span style="font-size:11px;">${filtrosAtivos}</span>` : ''}<br>
                            <span style="font-size:11px; color:${publicado ? '#2E6F40' : '#C98219'}; font-weight:700;">${publicado ? '● Publicado' : `○ ${simulado.status}`}</span>
                        </div>
                        <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
                            <button onclick="editarSimuladoNaCaixa('${simulado.id}')" style="padding:6px 10px; border-radius:6px; border:1px solid var(--marrom-header); background:#fff; color:var(--marrom-header); cursor:pointer; font-weight:700; font-size:12px;">Editar</button>
                            <button onclick="alternarPublicacaoSimulado('${simulado.id}', '${simulado.status}')" style="padding:6px 10px; border-radius:6px; border:1px solid #888; cursor:pointer; font-weight:700; font-size:12px;">${publicado ? 'Despublicar' : 'Publicar'}</button>
                            <button onclick="excluirSimulado('${simulado.id}', '${simulado.titulo.replace(/'/g, "\\'")}')" style="padding:6px 10px; border-radius:6px; border:none; background:#C9302C; color:#fff; cursor:pointer; font-weight:700; font-size:12px;">Excluir</button>
                        </div>
                    </div>`;
                }).join('');
            }
            const csvSelect = document.getElementById('adm-csv-simid');
            if (csvSelect) {
                const atual = csvSelect.value;
                csvSelect.innerHTML = '<option value="">Selecione...</option>' + (simulados || [])
                    .map(simulado => `<option value="${simulado.id}">${simulado.titulo} (${(simulado.questoes || []).length})</option>`).join('');
                if ([...(simulados || [])].some(simulado => simulado.id === atual)) csvSelect.value = atual;
            }
        }

        async function alternarPublicacaoSimulado(id, statusAtual) {
            const novoStatus = statusAtual === 'publicado' ? 'rascunho' : 'publicado';
            const { error } = await window.supabase.from('simulados').update({
                status: novoStatus,
                published_at: novoStatus === 'publicado' ? new Date().toISOString() : null
            }).eq('id', id);
            if (error) return mostrarToast('error', error.message, { title: 'Erro ao atualizar simulado' });
            mostrarToast('success', `O simulado foi ${novoStatus === 'publicado' ? 'publicado' : 'movido para rascunho'}.`, { title: 'Status atualizado' });
            await carregarListasAdmin();
            sincronizarPortal('simulados');
        }

        async function excluirSimulado(id, titulo) {
            const confirmado = await confirmarAcao({
                title: 'Excluir simulado?',
                message: `O simulado “${titulo}” será removido permanentemente. Esta ação não pode ser desfeita.`,
                confirmLabel: 'Excluir simulado',
                tone: 'danger'
            });
            if (!confirmado) return;
            const { error } = await window.supabase.from('simulados').delete().eq('id', id);
            if (error) return mostrarToast('error', error.message, { title: 'Erro ao excluir simulado' });
            mostrarToast('success', `O simulado “${titulo}” foi excluído.`, { title: 'Simulado excluído' });
            if (document.getElementById('adm-sim-id').value === id) novoSimulado();
            await carregarListasAdmin();
            sincronizarPortal('simulados');
        }

        async function alternarVisibilidade(colecao, docId, estadoAtual) {
            try {
                await db.collection(colecao).doc(docId).update({ ativo: !estadoAtual });
                mostrarToast('success', `O item agora está ${estadoAtual ? 'oculto' : 'visível'} no site.`, { title: 'Visibilidade atualizada' });
                await carregarListasAdmin();
                sincronizarPortal(colecao);
            } catch (error) {
                mostrarToast('error', error.message, { title: 'Erro ao atualizar item' });
            }
        }

        async function excluirItemBanco(colecao, docId) {
            const nomes = { apostilas: 'apostila', cupons_sistema: 'cupom' };
            const nomeItem = nomes[colecao] || 'item';
            const confirmado = await confirmarAcao({
                title: `Excluir ${nomeItem}?`,
                message: `O ${nomeItem} “${docId}” será removido permanentemente. Esta ação não pode ser desfeita.`,
                confirmLabel: `Excluir ${nomeItem}`,
                tone: 'danger'
            });
            if (!confirmado) return;
            try {
                await db.collection(colecao).doc(docId).delete();
                mostrarToast('success', 'O item foi excluído permanentemente.', { title: 'Item excluído' });
                if (colecao === 'cupons_sistema') await carregarCuponsNoAdmin();
                else await carregarListasAdmin();
                sincronizarPortal(colecao);
            } catch (error) {
                mostrarToast('error', error.message, { title: 'Erro ao excluir item' });
            }
        }

function alternarCamposTipoCupomAdmin() {
            const tipo = document.getElementById('adm-cupom-tipo').value;
            document.getElementById('box-adm-cupom-cron2').style.display = (tipo === 'premium') ? 'block' : 'none';
            document.getElementById('box-adm-cupom-porcentagem').style.display = (tipo === 'apostila') ? 'block' : 'none';
        }

        async function salvarCupomAdmin() {
            if (!validarCamposObrigatorios([['adm-cupom-codigo', 'Código do cupom']])) return;
            const codigoRaw = document.getElementById('adm-cupom-codigo').value.trim().toUpperCase();
            const codigo = codigoRaw.replace(/[^A-Z0-9]/g, '').slice(0, 10);
            const tipo = document.getElementById('adm-cupom-tipo').value;
            const limiteInput = parseInt(document.getElementById('adm-cupom-limite').value);
            const cron1Input = parseInt(document.getElementById('adm-cupom-cron1').value);
            const cron2Input = parseInt(document.getElementById('adm-cupom-cron2').value);
            const descInput = parseInt(document.getElementById('adm-cupom-desconto').value);
            if (!codigo) {
                mostrarToast('warning', 'Digite um código alfanumérico de até 10 caracteres.', { title: 'Código inválido' });
                return;
            }

            const agoraMs = Date.now();
            const expiraEmMs = (!isNaN(cron1Input) && cron1Input > 0) ? (agoraMs + cron1Input * 86400000) : null;
            const duracaoDias = (tipo === 'premium' && !isNaN(cron2Input) && cron2Input > 0) ? cron2Input : null;
            const descontoPorcentagem = (tipo === 'apostila') ? Math.min(100, Math.max(1, descInput || 100)) : null;
            const limiteUsos = (!isNaN(limiteInput) && limiteInput > 0) ? limiteInput : null;

            let tituloGerado = "";
            if (tipo === 'premium') {
                tituloGerado = duracaoDias ? `${duracaoDias} dias de Matéria Premium! (${codigo})` : `Matéria Premium Vitalício! (${codigo})`;
            } else {
                tituloGerado = `${descontoPorcentagem}% de desconto em qualquer apostila! (${codigo})`;
            }

            try {
                await db.collection("cupons_sistema").doc(codigo).set({
                    codigo,
                    tipo,
                    titulo: tituloGerado,
                    criadoEmMs: agoraMs,
                    expiraEmMs,
                    duracaoDias,
                    descontoPorcentagem,
                    limiteUsos,
                    usosAtuais: 0,
                    ativoParaObter: true
                });

                definirStatus('status-cupom-admin', `Cupom '${codigo}' criado com sucesso.`);
                mostrarToast('success', `O cupom ${codigo} foi criado e já está disponível.`, { title: 'Cupom criado' });
                document.getElementById('adm-cupom-codigo').value = "";
                await carregarCuponsNoAdmin();
            } catch (e) {
                mostrarToast('error', e.message || 'Não foi possível criar o cupom.', { title: 'Erro ao criar cupom' });
            }
        }

        async function carregarCuponsNoAdmin() {
            const divCupons = document.getElementById('lista-admin-cupons');
            if (!divCupons) return;

            const snap = await db.collection("cupons_sistema").get();
            if (snap.empty) {
                divCupons.innerHTML = "<p style='color:#777;'>Nenhum cupom cadastrado.</p>";
                return;
            }

            const agora = Date.now();
            divCupons.innerHTML = snap.docs.map(doc => {
                const c = doc.data();
                const vencido = c.expiraEmMs && agora > c.expiraEmMs;
                const esgotado = c.limiteUsos && (c.usosAtuais || 0) >= c.limiteUsos;
                const podeObter = c.ativoParaObter !== false && !vencido && !esgotado;

                let textoCron1 = "Sem prazo (Cron. 1)";
                if (c.expiraEmMs) {
                    const diasRest = Math.ceil((c.expiraEmMs - agora) / 86400000);
                    textoCron1 = diasRest > 0 ? `Expira em ${diasRest} dia(s)` : `Expirado`;
                }

                let textoDetalhe = c.tipo === 'premium'
                    ? (c.duracaoDias ? `Cron. 2: ${c.duracaoDias} dias após ativar` : `Cron. 2: Vitalício`)
                    : `Desconto: ${c.descontoPorcentagem}% OFF`;

                let textoLimite = c.limiteUsos ? `${c.usosAtuais || 0}/${c.limiteUsos} obtidos` : `${c.usosAtuais || 0} obtidos (Ilimitado)`;

                return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border:1px solid #ddd; border-radius:8px; margin-bottom:8px; background:${podeObter ? '#fff' : '#f5f5f5'};">
                    <div>
                        <strong style="font-size:15px; color:var(--marrom-header);">${c.codigo}</strong> — <span>${c.titulo}</span><br>
                        <span style="font-size:11px; color:#555; font-weight:600;">
                            ⏳ ${textoCron1} | ⚡ ${textoDetalhe} | 👥 ${textoLimite}
                        </span><br>
                        <span style="font-size:11px; color:${podeObter ? '#2E6F40' : '#C9302C'}; font-weight:700;">
                            ${podeObter ? '● Obtenção Ativa' : '○ Obtenção Bloqueada (' + (vencido ? 'Tempo Esgotado' : esgotado ? 'Limite Atingido' : 'Desativado') + ')'}
                        </span>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button onclick="alternarObtencaoCupom('${c.codigo}', ${c.ativoParaObter !== false})" style="padding:6px 10px; border-radius:6px; border:1px solid #888; cursor:pointer; font-weight:700; font-size:12px;">
                            ${c.ativoParaObter !== false ? 'Desativar Obtenção' : 'Ativar Obtenção'}
                        </button>
                        <button onclick="excluirItemBanco('cupons_sistema', '${c.codigo}')" style="padding:6px 10px; border-radius:6px; border:none; background:#C9302C; color:#fff; cursor:pointer; font-weight:700; font-size:12px;">
                            Excluir
                        </button>
                    </div>
                </div>`;
            }).join('');
        }

        async function alternarObtencaoCupom(codigo, estadoAtual) {
            try {
                await db.collection("cupons_sistema").doc(codigo).update({ ativoParaObter: !estadoAtual });
                mostrarToast('success', `A obtenção do cupom ${codigo} foi ${estadoAtual ? 'desativada' : 'ativada'}.`, { title: 'Cupom atualizado' });
                await carregarCuponsNoAdmin();
            } catch (error) {
                mostrarToast('error', error.message, { title: 'Erro ao atualizar cupom' });
            }
        }

        window.addEventListener('DOMContentLoaded', () => {
            carregarListasAdmin();
            carregarCuponsNoAdmin();
        });

        navegarAdmin(secaoAdminAtual(), false);

        async function importarPlanilhaCSV() {
            if (!validarCamposObrigatorios([['adm-csv-simid', 'Simulado'], ['adm-sim-csv', 'Arquivo CSV']])) return;
            const input = document.getElementById('adm-sim-csv');
            const simId = document.getElementById('adm-csv-simid').value;
            const mode = document.getElementById('adm-csv-mode').value;
            const encoding = document.getElementById('adm-csv-encoding').value;
            const status = document.getElementById('status-importacao-csv');
            if (!input.files.length || !simId) return mostrarToast('warning', 'Selecione um simulado e um arquivo CSV.', { title: 'Importação incompleta' });

            const { data: simulado, error: loadError } = await window.supabase
                .from('simulados').select('id,titulo,questoes').eq('id', simId).single();
            if (loadError) return mostrarToast('error', loadError.message, { title: 'Erro ao carregar simulado' });
            status.innerText = 'Lendo e validando a planilha...';

            Papa.parse(input.files[0], {
                header: false,
                skipEmptyLines: true,
                encoding,
                complete: async ({ data: linhas }) => {
                    const novasQuestoes = linhas.flatMap((linha, index) => {
                        if (!String(linha[0] || '').trim()) return [];
                        if (index === 0 && String(linha[0]).toLowerCase().includes('enunciado')) return [];
                        const legacy = {
                            Enunciado: String(linha[0] || '').trim(),
                            Alternativa_Correta: String(linha[1] || '').trim(),
                            Incorreta_1: String(linha[2] || '').trim(),
                            Incorreta_2: String(linha[3] || '').trim(),
                            Incorreta_3: String(linha[4] || '').trim(),
                            Incorreta_4: String(linha[5] || '').trim(),
                            Explicacao: String(linha[6] || '').trim(),
                            dificuldade: String(linha[7] || '').trim(),
                            assunto: String(linha[8] || '').trim(),
                            subsecao: String(linha[9] || '').trim(),
                            secao: String(linha[10] || '').trim(),
                            capitulo: String(linha[11] || '').trim(),
                            modulo: String(linha[12] || '').trim(),
                            bloco: String(linha[13] || '1').trim()
                        };
                        return [{
                            id: crypto.randomUUID(), enunciado: legacy.Enunciado, comentario: legacy.Explicacao,
                            dificuldade: legacy.dificuldade || null, assunto: legacy.assunto || null,
                            subsecao: legacy.subsecao || null, secao: legacy.secao || null,
                            capitulo: legacy.capitulo || null, modulo: legacy.modulo || null,
                            bloco: legacy.bloco || null, status: 'publicado', metadata: legacy
                        }];
                    });
                    if (!novasQuestoes.length) {
                        definirStatus('status-importacao-csv', 'Nenhuma questão válida encontrada.', 'warning');
                        mostrarToast('warning', 'O arquivo não contém questões válidas para importar.', { title: 'Nenhuma questão encontrada' });
                        return;
                    }
                    const questoes = mode === 'append' ? [...(simulado.questoes || []), ...novasQuestoes] : novasQuestoes;
                    status.innerText = `Salvando ${questoes.length} questões...`;
                    const { error } = await window.supabase.from('simulados').update({
                        questoes, quantidade_questoes: questoes.length, updated_at: new Date().toISOString()
                    }).eq('id', simulado.id);
                    if (error) {
                        definirStatus('status-importacao-csv', 'Erro: ' + error.message, 'error');
                        mostrarToast('error', error.message, { title: 'Erro ao importar questões' });
                        return;
                    }
                    definirStatus('status-importacao-csv', `${novasQuestoes.length} questões importadas. Total: ${questoes.length}.`);
                    mostrarToast('success', `${novasQuestoes.length} questões foram importadas. O simulado agora possui ${questoes.length}.`, { title: 'Importação concluída' });
                    await carregarListasAdmin();
                    await editarSimuladoNaCaixa(simulado.id);
                    sincronizarPortal('simulados');
                },
                error: (error) => {
                    definirStatus('status-importacao-csv', 'Não foi possível ler o arquivo.', 'error');
                    mostrarToast('error', error.message || 'Não foi possível ler o arquivo CSV.', { title: 'Erro na planilha' });
                },
            });
        }
async function carregarTagsAdmin() {
    const tipo = document.getElementById('adm-tag-tipo').value;
    const token = ++carregamentoTagsAdmin;
    const conteudoSelect = document.getElementById('adm-tag-conteudo');
    const selecionado = conteudoSelect.value;
    document.getElementById('adm-tags-vincular').disabled = true;
    definirStatus('status-tags', 'Carregando tags...');
    try {
        const [tags, conteudos] = await Promise.all([
            window.supabase.from('content_tags').select('id,nome,tipo').eq('tipo', tipo).order('nome'),
            window.supabase.from(tipo === 'apostila' ? 'apostilas' : 'simulados').select('id,titulo,tags').order('titulo'),
        ]);
        if (token !== carregamentoTagsAdmin) return;
        if (tags.error || conteudos.error) throw tags.error || conteudos.error;
        tagsAdmin = tags.data || [];
        conteudosTagsAdmin = conteudos.data || [];
        const lista = document.getElementById('lista-admin-tags');
        lista.replaceChildren();
        if (!tagsAdmin.length) lista.textContent = 'Nenhuma tag cadastrada para este tipo.';
        tagsAdmin.forEach(tag => {
            const item = document.createElement('div');
            item.className = 'admin-tag-row';
            const nome = document.createElement('input');
            nome.value = tag.nome;
            nome.maxLength = 80;
            nome.setAttribute('aria-label', `Nome da tag ${tag.nome}`);
            const editar = document.createElement('button');
            editar.className = 'admin-secondary-button';
            editar.textContent = 'Salvar';
            editar.onclick = () => alterarTagAdmin(tag, nome.value, item);
            const excluir = document.createElement('button');
            excluir.className = 'admin-secondary-button';
            excluir.textContent = 'Excluir';
            excluir.onclick = () => alterarTagAdmin(tag, null, item);
            item.append(nome, editar, excluir);
            lista.appendChild(item);
        });
        conteudoSelect.replaceChildren(new Option('Selecione...', ''));
        conteudosTagsAdmin.forEach(item => conteudoSelect.add(new Option(item.titulo, item.id)));
        conteudoSelect.value = conteudosTagsAdmin.some(item => item.id === selecionado) ? selecionado : '';
        selecionarConteudoTagsAdmin();
        definirStatus('status-tags');
    } catch (error) {
        if (token !== carregamentoTagsAdmin) return;
        tagsAdmin = [];
        conteudosTagsAdmin = [];
        conteudoSelect.replaceChildren(new Option('Selecione...', ''));
        document.getElementById('adm-tags-opcoes').replaceChildren();
        definirStatus('status-tags', error.message || 'Erro ao carregar tags.', 'error');
    }
}

function selecionarConteudoTagsAdmin() {
    const item = conteudosTagsAdmin.find(row => row.id === document.getElementById('adm-tag-conteudo').value);
    const opcoes = document.getElementById('adm-tags-opcoes');
    opcoes.replaceChildren();
    tagsAdmin.forEach(tag => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = tag.nome;
        input.checked = Boolean(item?.tags?.includes(tag.nome));
        input.disabled = !item;
        label.append(input, document.createTextNode(tag.nome));
        opcoes.appendChild(label);
    });
    document.getElementById('adm-tags-vincular').disabled = !item;
}

async function criarTagAdmin() {
    const nome = document.getElementById('adm-tag-nome').value.trim().toUpperCase();
    if (!nome || nome.length > 80) return definirStatus('status-tags', 'Informe um nome com at\u00e9 80 caracteres.', 'error');
    const button = document.getElementById('adm-tag-criar');
    button.disabled = true;
    try {
        const { error } = await window.supabase.from('content_tags').insert({ nome, tipo: document.getElementById('adm-tag-tipo').value });
        if (error) throw error;
        document.getElementById('adm-tag-nome').value = '';
        await carregarTagsAdmin();
        definirStatus('status-tags', 'Tag criada com sucesso.');
    } catch (error) {
        definirStatus('status-tags', error.code === '23505' ? 'J\u00e1 existe uma tag com este nome para este tipo.' : error.message, 'error');
    } finally { button.disabled = false; }
}

async function salvarTagsConteudoAdmin() {
    const id = document.getElementById('adm-tag-conteudo').value;
    const tipo = document.getElementById('adm-tag-tipo').value;
    const item = conteudosTagsAdmin.find(row => row.id === id);
    if (!item) return;
    const tags = [...document.querySelectorAll('#adm-tags-opcoes input:checked')].map(input => input.value);
    // Keep any existing legacy tags that are not represented in the registry.
    const preservadas = (item.tags || []).filter(nome => !tagsAdmin.some(tag => tag.nome === nome));
    const button = document.getElementById('adm-tags-vincular');
    button.disabled = true;
    try {
        const { error } = await window.supabase.from(tipo === 'apostila' ? 'apostilas' : 'simulados')
            .update({ tags: [...new Set([...preservadas, ...tags])] }).eq('id', id).select('id').single();
        if (error) throw error;
        await carregarTagsAdmin();
        definirStatus('status-tags', 'Tags do conte\u00fado salvas.');
        sincronizarPortal(tipo === 'apostila' ? 'apostilas' : 'simulados');
    } catch (error) { definirStatus('status-tags', error.message, 'error'); }
    finally { button.disabled = !document.getElementById('adm-tag-conteudo').value; }
}
async function carregarTagsFormularioAdmin(tipo, selecionadas) {
    const select = document.getElementById(tipo === 'apostila' ? 'adm-ap-tags' : 'adm-sim-tags');
    if (!select) return;
    const token = String(Number(select.dataset.request || 0) + 1);
    select.dataset.request = token;
    const atuais = selecionadas || [...select.selectedOptions].map(option => option.value);
    select.disabled = true;
    try {
        const { data, error } = await window.supabase.from('content_tags').select('nome').eq('tipo', tipo).order('nome');
        if (select.dataset.request !== token) return;
        if (error) throw error;
        const nomes = [...new Set([...(data || []).map(tag => tag.nome), ...atuais])];
        select.replaceChildren();
        nomes.forEach(nome => select.add(new Option(nome, nome, false, atuais.includes(nome))));
        if (!nomes.length) {
            const option = new Option('Cadastre uma tag na aba Tags', '');
            option.disabled = true;
            select.add(option);
        }
        select.disabled = false;
        select.removeAttribute('aria-invalid');
    } catch (error) {
        if (select.dataset.request !== token) return;
        select.replaceChildren(new Option('Erro ao carregar tags. Reabra esta aba.', ''));
        definirStatus(tipo === 'apostila' ? 'status-ap' : 'status-sim', error.message, 'error');
    }
}
async function alterarTagAdmin(tag, nome, linha) {
    const novoNome = nome === null ? null : nome.trim().toUpperCase();
    if (novoNome !== null && (!novoNome || novoNome.length > 80)) {
        return definirStatus('status-tags', 'Informe um nome com at\u00e9 80 caracteres.', 'error');
    }
    if (novoNome === null && !await confirmarAcao({
        title: 'Excluir tag?',
        message: `A tag "${tag.nome}" ser\u00e1 removida dos conte\u00fados vinculados. Os conte\u00fados ser\u00e3o mantidos.`,
        confirmLabel: 'Excluir tag', tone: 'danger',
    })) return;
    const controles = [...linha.querySelectorAll('input, button')];
    controles.forEach(element => { element.disabled = true; });
    try {
        const { error } = await window.supabase.rpc('manage_content_tag', { p_id: tag.id, p_nome: novoNome });
        if (error) throw error;
        const select = document.getElementById(tag.tipo === 'apostila' ? 'adm-ap-tags' : 'adm-sim-tags');
        const selecionadas = [...select.selectedOptions].map(option => option.value)
            .flatMap(valor => valor === tag.nome ? (novoNome === null ? [] : [novoNome]) : [valor]);
        await carregarTagsAdmin();
        await carregarTagsFormularioAdmin(tag.tipo, selecionadas);
        sincronizarPortal(tag.tipo === 'apostila' ? 'apostilas' : 'simulados');
        definirStatus('status-tags', novoNome === null ? 'Tag exclu\u00edda.' : 'Tag atualizada.');
    } catch (error) {
        definirStatus('status-tags', error.code === '23505' ? 'J\u00e1 existe uma tag com este nome para este tipo.' : error.message, 'error');
    } finally { controles.forEach(element => { element.disabled = false; }); }
}
