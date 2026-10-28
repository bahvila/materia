// Supabase é exposto pela camada de compatibilidade carregada pelo React.
        firebase.initializeApp({ provider: "supabase" });
        const db = firebase.firestore();
        const auth = firebase.auth();
        const adminSections = ['apostilas', 'simulados', 'cupons'];

        function secaoAdminAtual() {
            try {
                const parentMatch = window.parent.location.pathname.match(/^\/administrador\/(apostilas|simulados|cupons)/);
                if (parentMatch) return parentMatch[1];
            } catch (_) { /* iframe isolado: usa a query local */ }
            const querySection = new URLSearchParams(window.location.search).get('section');
            return adminSections.includes(querySection) ? querySection : 'apostilas';
        }

        function navegarAdmin(section, updateAddress = true) {
            const target = adminSections.includes(section) ? section : 'apostilas';
            document.querySelectorAll('.admin-page').forEach(page => page.classList.remove('active'));
            document.querySelectorAll('.admin-nav-button').forEach(button => button.classList.toggle('active', button.dataset.adminSection === target));
            document.getElementById(`admin-page-${target}`)?.classList.add('active');
            if (updateAddress) {
                try {
                    window.parent.history.pushState({ separador: 'administrador', adminSection: target }, '', `/administrador/${target}`);
                    window.parent.document.title = `${target.charAt(0).toUpperCase() + target.slice(1)} | Administrador | Matéria`;
                } catch (_) {
                    window.history.pushState({}, '', `/admin?section=${target}`);
                }
            }
        }

        function fazerLoginAdmin() {
            const email = document.getElementById('adm-login-email').value.trim();
            const senha = document.getElementById('adm-login-senha').value;
            if (!email || !senha) {
                alert("Preencha o e-mail e a senha de administrador.");
                return;
            }
            auth.signInWithEmailAndPassword(email, senha)
                .then(() => {
                    document.getElementById('adm-login-senha').value = "";
                })
                .catch(err => {
                    alert("Erro ao autenticar: verifique seu e-mail e senha no Supabase Auth.\n\nDetalhe: " + err.message);
                });
        }

        function fazerLogoutAdmin() {
            auth.signOut();
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
                    return;
                }
                boxLogin.style.display = 'none';
                boxLogado.style.display = 'flex';
                document.getElementById('label-email-admin').innerText = user.email;
                carregarListasAdmin();
                carregarCuponsNoAdmin();
            } else {
                boxLogin.style.display = 'flex';
                boxLogado.style.display = 'none';
            }
        });

        async function salvarApostila() {
            const nova = {
                titulo: document.getElementById('adm-ap-titulo').value.trim(),
                subtitulo: document.getElementById('adm-ap-sub').value.trim(),
                preco: document.getElementById('adm-ap-preco').value.trim(),
                capaUrl: document.getElementById('adm-ap-capa').value.trim(),
                pdfUrl: document.getElementById('adm-ap-pdf').value.trim(),
                descricao: document.getElementById('adm-ap-desc').value.trim(),
                ano: "2026",
                ativo: true
            };
            if (!nova.titulo) { alert("Preencha o título."); return; }

            try {
                await db.collection("apostilas").add(nova);
                document.getElementById('status-ap').innerText = "✅ Apostila publicada com sucesso!";
                carregarListasAdmin();
            } catch (e) {
                alert("Erro ao salvar: " + e.message);
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
            document.getElementById('adm-sim-id').value = '';
            document.getElementById('adm-sim-titulo').value = '';
            document.getElementById('adm-sim-slug').value = '';
            document.getElementById('adm-sim-desc').value = '';
            document.getElementById('adm-sim-capa').value = '';
            document.getElementById('adm-sim-qtd').value = '0';
            document.getElementById('adm-sim-tempo').value = '60';
            document.getElementById('adm-sim-status').value = 'rascunho';
            preencherFiltrosQuestoes();
            document.getElementById('status-sim').innerText = '';
            document.getElementById('adm-sim-titulo').focus();
        }

        document.getElementById('adm-sim-titulo')?.addEventListener('input', event => {
            if (!document.getElementById('adm-sim-id').value) {
                document.getElementById('adm-sim-slug').value = gerarSlug(event.target.value);
            }
        });

        async function salvarConfigSimulado() {
            const id = document.getElementById('adm-sim-id').value;
            const titulo = document.getElementById('adm-sim-titulo').value.trim();
            const slug = document.getElementById('adm-sim-slug').value.trim() || gerarSlug(titulo);
            if (!titulo || !slug) return alert('Informe o título do simulado.');

            const filtros = {};
            camposTaxonomia.forEach(campo => {
                const valor = document.getElementById(`filtro-col-${campo}`).value;
                if (valor) filtros[campo] = valor;
            });
            const row = {
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
            if (error) return alert('Erro ao salvar simulado: ' + error.message);
            document.getElementById('adm-sim-id').value = data.id;
            document.getElementById('status-sim').innerText = '✅ Simulado salvo com sucesso.';
            await carregarListasAdmin();
        }

        async function editarSimuladoNaCaixa(id) {
            const { data, error } = await window.supabase.from('simulados').select('*').eq('id', id).single();
            if (error) return alert('Erro ao carregar simulado: ' + error.message);
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
                                🗑️
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
                            <button onclick="excluirSimulado('${simulado.id}', '${simulado.titulo.replace(/'/g, "\\'")}')" style="padding:6px 10px; border-radius:6px; border:none; background:#C9302C; color:#fff; cursor:pointer; font-weight:700; font-size:12px;">🗑️</button>
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
            if (error) return alert('Erro ao atualizar simulado: ' + error.message);
            carregarListasAdmin();
        }

        async function excluirSimulado(id, titulo) {
            if (!confirm(`Excluir permanentemente o simulado "${titulo}"?`)) return;
            const { error } = await window.supabase.from('simulados').delete().eq('id', id);
            if (error) return alert('Erro ao excluir simulado: ' + error.message);
            if (document.getElementById('adm-sim-id').value === id) novoSimulado();
            carregarListasAdmin();
        }

        async function alternarVisibilidade(colecao, docId, estadoAtual) {
            await db.collection(colecao).doc(docId).update({ ativo: !estadoAtual });
            carregarListasAdmin();
        }

        async function excluirItemBanco(colecao, docId) {
            if (!confirm(`Tem certeza que deseja excluir o item '${docId}' da vitrine do site?`)) return;
            await db.collection(colecao).doc(docId).delete();
            carregarListasAdmin();
        }

function alternarCamposTipoCupomAdmin() {
            const tipo = document.getElementById('adm-cupom-tipo').value;
            document.getElementById('box-adm-cupom-cron2').style.display = (tipo === 'premium') ? 'block' : 'none';
            document.getElementById('box-adm-cupom-porcentagem').style.display = (tipo === 'apostila') ? 'block' : 'none';
        }

        async function salvarCupomAdmin() {
            const codigoRaw = document.getElementById('adm-cupom-codigo').value.trim().toUpperCase();
            const codigo = codigoRaw.replace(/[^A-Z0-9]/g, '').slice(0, 10);
            const tipo = document.getElementById('adm-cupom-tipo').value;
            const limiteInput = parseInt(document.getElementById('adm-cupom-limite').value);
            const cron1Input = parseInt(document.getElementById('adm-cupom-cron1').value);
            const cron2Input = parseInt(document.getElementById('adm-cupom-cron2').value);
            const descInput = parseInt(document.getElementById('adm-cupom-desconto').value);
            const status = document.getElementById('status-cupom-admin');

            if (!codigo) {
                alert("Digite um código alfanumérico (máx 10 caracteres).");
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

                status.innerText = `✅ Cupom '${codigo}' criado com sucesso!`;
                document.getElementById('adm-cupom-codigo').value = "";
                carregarListasAdmin();
            } catch (e) {
                alert("Erro ao criar cupom: " + e.message);
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
                            🗑️
                        </button>
                    </div>
                </div>`;
            }).join('');
        }

        async function alternarObtencaoCupom(codigo, estadoAtual) {
            await db.collection("cupons_sistema").doc(codigo).update({ ativoParaObter: !estadoAtual });
            carregarCuponsNoAdmin();
        }

        window.addEventListener('DOMContentLoaded', () => {
            carregarListasAdmin();
            carregarCuponsNoAdmin();
        });

        navegarAdmin(secaoAdminAtual(), false);

        async function importarPlanilhaCSV() {
            const input = document.getElementById('adm-sim-csv');
            const simId = document.getElementById('adm-csv-simid').value;
            const mode = document.getElementById('adm-csv-mode').value;
            const encoding = document.getElementById('adm-csv-encoding').value;
            const status = document.getElementById('status-importacao-csv');
            if (!input.files.length || !simId) return alert('Selecione um simulado e um arquivo CSV.');

            const { data: simulado, error: loadError } = await window.supabase
                .from('simulados').select('id,titulo,questoes').eq('id', simId).single();
            if (loadError) return alert('Erro ao carregar simulado: ' + loadError.message);
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
                        status.innerText = '⚠️ Nenhuma questão válida encontrada.';
                        return;
                    }
                    const questoes = mode === 'append' ? [...(simulado.questoes || []), ...novasQuestoes] : novasQuestoes;
                    status.innerText = `Salvando ${questoes.length} questões...`;
                    const { error } = await window.supabase.from('simulados').update({
                        questoes, quantidade_questoes: questoes.length, updated_at: new Date().toISOString()
                    }).eq('id', simulado.id);
                    if (error) {
                        status.innerText = '❌ Erro: ' + error.message;
                        return;
                    }
                    status.innerText = `✅ ${novasQuestoes.length} questões importadas. Total: ${questoes.length}.`;
                    await carregarListasAdmin();
                    await editarSimuladoNaCaixa(simulado.id);
                }
            });
        }
