// Supabase é exposto pela camada de compatibilidade carregada pelo React.
        firebase.initializeApp({ provider: "supabase" });
        const db = firebase.firestore();
        const auth = firebase.auth();

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
                    alert('Este usuário não possui permissão de administrador.');
                    await auth.signOut();
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

        // Extrai um nome limpo caso comece com "simulado-" (Ex: "simulado-anac-comissario" -> "Anac Comissario")
        function formatarSufixoSimulado(idColecao) {
            let limpo = idColecao.replace(/^simulado[-_]?/i, '');
            return limpo.split(/[-_]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
        }

        // Lê a coleção "simulado-..." no Firestore e preenche as opções das colunas 8 a 14
        async function inspecionarColecaoSimulado(idOpcional, filtrosSalvos = {}) {
            const idInput = document.getElementById('adm-sim-id');
            if (idOpcional) idInput.value = idOpcional;
            const colId = idInput.value.trim();
            const status = document.getElementById('status-sim');

            if (!colId) { alert("Digite o ID da coleção (ex: simulado-anac-comissario-de-voo)."); return; }

            status.innerText = `🔄 Lendo questões da coleção '${colId}'...`;
            try {
                const snap = await db.collection(colId).get();
                if (snap.empty) {
                    status.innerText = `⚠️ Nenhuma questão encontrada na coleção '${colId}'. Verifique se digitou o nome exato.`;
                    return;
                }

                // Coleta valores únicos das colunas 8 a 14
                const valoresUnicos = {};
                camposTaxonomia.forEach(c => valoresUnicos[c] = new Set());

                snap.docs.forEach(doc => {
                    const d = doc.data();
                    camposTaxonomia.forEach(c => {
                        if (d[c] && String(d[c]).trim() !== "") {
                            valoresUnicos[c].add(String(d[c]).trim());
                        }
                    });
                });

                // Popula os <select>
                camposTaxonomia.forEach(c => {
                    const sel = document.getElementById(`filtro-col-${c}`);
                    const valorAtual = filtrosSalvos[c] || "";
                    const opcoes = Array.from(valoresUnicos[c]).sort();
                    sel.innerHTML = `<option value="">Todos (${opcoes.length} opções)</option>` +
                        opcoes.map(v => `<option value="${v}" ${v === valorAtual ? 'selected' : ''}>${v}</option>`).join('');
                });

                // Se os campos de Título estiverem vazios, sugere automaticamente a partir do nome depois de "simulado-"
                if (!document.getElementById('adm-sim-titulo').value.trim()) {
                    document.getElementById('adm-sim-titulo').value = formatarSufixoSimulado(colId);
                }

                // Se essa coleção ainda não estava listada em simulados_info, registra automaticamente!
                const infoDoc = await db.collection("simulados_info").doc(colId).get();
                if (!infoDoc.exists) {
                    await db.collection("simulados_info").doc(colId).set({
                        id: colId,
                        colecaoQuestoes: colId,
                        tituloVisivel: document.getElementById('adm-sim-titulo').value.trim() || formatarSufixoSimulado(colId),
                        descricaoVisivel: document.getElementById('adm-sim-desc').value.trim() || "Simulado Geral",
                        nome: `${document.getElementById('adm-sim-titulo').value.trim() || formatarSufixoSimulado(colId)}: Geral`,
                        questoes_banca: 20,
                        tempo_banca: 60,
                        filtros: {},
                        ativo: true
                    }, { merge: true });
                    carregarListasAdmin();
                }

                status.innerText = `✅ ${snap.size} questões encontradas em '${colId}'! Filtros das colunas 8 a 14 carregados.`;
            } catch (e) {
                alert("Erro ao ler coleção: " + e.message);
            }
        }

        async function salvarConfigSimulado() {
            const id = document.getElementById('adm-sim-id').value.trim();
            const tituloVisivel = document.getElementById('adm-sim-titulo').value.trim();
            const descricaoVisivel = document.getElementById('adm-sim-desc').value.trim();
            const capaUrl = document.getElementById('adm-sim-capa').value.trim();
            const qtd = parseInt(document.getElementById('adm-sim-qtd').value) || 20;
            const tempo = parseInt(document.getElementById('adm-sim-tempo').value) || 60;

            if (!id || !tituloVisivel) {
                alert("Preencha o ID da coleção e o Texto Visível (Título Principal).");
                return;
            }

            // Captura os filtros escolhidos nas colunas 8 a 14
            const filtros = {};
            camposTaxonomia.forEach(c => {
                const val = document.getElementById(`filtro-col-${c}`).value.trim();
                if (val !== "") filtros[c] = val;
            });

            try {
                await db.collection("simulados_info").doc(id).set({
                    id,
                    colecaoQuestoes: id,
                    tituloVisivel,
                    descricaoVisivel,
                    nome: descricaoVisivel ? `${tituloVisivel}: ${descricaoVisivel}` : tituloVisivel,
                    capaUrl,
                    questoes_banca: qtd,
                    tempo_banca: tempo,
                    filtros,
                    ativo: true
                }, { merge: true });

                document.getElementById('status-sim').innerText = "✅ Simulado configurado e atualizado no site!";
                carregarListasAdmin();
            } catch (e) {
                alert("Erro ao salvar simulado: " + e.message);
            }
        }

        async function editarSimuladoNaCaixa(docId) {
            const doc = await db.collection("simulados_info").doc(docId).get();
            if (!doc.exists) return;
            const d = doc.data();

            document.getElementById('adm-sim-id').value = doc.id;
            document.getElementById('adm-sim-titulo').value = d.tituloVisivel || (d.nome ? d.nome.split(':')[0].trim() : formatarSufixoSimulado(doc.id));
            document.getElementById('adm-sim-desc').value = d.descricaoVisivel || (d.nome && d.nome.includes(':') ? d.nome.split(':').slice(1).join(':').trim() : "");
            document.getElementById('adm-sim-capa').value = d.capaUrl || "";
            document.getElementById('adm-sim-qtd').value = d.questoes_banca || 20;
            document.getElementById('adm-sim-tempo').value = d.tempo_banca || 60;

            await inspecionarColecaoSimulado(doc.id, d.filtros || {});
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

            // 2. Listar Simulados (Mostrando nome sem o prefixo "simulado-", Título, Descrição e Filtros ativos)
            const snapSim = await db.collection("simulados_info").get();
            if (snapSim.empty) {
                divSim.innerHTML = "<p style='color:#777;'>Nenhum simulado registrado ainda. Digite o ID 'simulado-...' na Caixa 2 e clique em '🔍 Ler Coleção'.</p>";
            } else {
                divSim.innerHTML = snapSim.docs.map(doc => {
                    const d = doc.data();
                    const visivel = d.ativo !== false;
                    const sufixoColecao = doc.id.replace(/^simulado[-_]?/i, '');
                    const titulo = d.tituloVisivel || d.nome || sufixoColecao;
                    const desc = d.descricaoVisivel || "";
                    const filtrosAtivos = d.filtros ? Object.entries(d.filtros).map(([k, v]) => `${k}: ${v}`).join(' | ') : '';

                    return `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border:1px solid #ddd; border-radius:8px; margin-bottom:8px; background:${visivel ? '#fff' : '#f5f5f5'};">
                        <div>
                            <span style="font-size:10px; background:#EBEBEB; padding:2px 6px; border-radius:4px; font-weight:700;">Coleção: ${sufixoColecao}</span><br>
                            <strong style="font-size:15px;">${titulo}</strong> ${desc ? `<span style="color:#555;">— ${desc}</span>` : ''}<br>
                            ${filtrosAtivos ? `<span style="font-size:11px; color:#46352E; font-weight:600;">🌪️ Filtro: ${filtrosAtivos}</span><br>` : ''}
                            <span style="font-size:11px; color:${visivel ? '#2E6F40' : '#C9302C'}; font-weight:700;">
                                ${visivel ? '● Visível no Site' : '○ Oculto no Site'}
                            </span>
                        </div>
                        <div style="display:flex; gap:6px;">
                            <button onclick="editarSimuladoNaCaixa('${doc.id}')" style="padding:6px 10px; border-radius:6px; border:1px solid var(--marrom-header); background:#fff; color:var(--marrom-header); cursor:pointer; font-weight:700; font-size:12px;">
                                ⚙️ Configurar
                            </button>
                            <button onclick="alternarVisibilidade('simulados_info', '${doc.id}', ${visivel})" style="padding:6px 10px; border-radius:6px; border:1px solid #888; cursor:pointer; font-weight:700; font-size:12px;">
                                ${visivel ? 'Ocultar' : 'Mostrar'}
                            </button>
                            <button onclick="excluirItemBanco('simulados_info', '${doc.id}')" style="padding:6px 10px; border-radius:6px; border:none; background:#C9302C; color:#fff; cursor:pointer; font-weight:700; font-size:12px;">
                                🗑️
                            </button>
                        </div>
                    </div>`;
                }).join('');
            }
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

        function importarPlanilhaCSV() {
            const input = document.getElementById('adm-sim-csv');
            const simId = document.getElementById('adm-csv-simid').value.trim();
            const encodingEscolhido = document.getElementById('adm-csv-encoding').value;
            const status = document.getElementById('status-importacao-csv');

            if (input.files.length === 0 || !simId) {
                alert("Selecione um arquivo CSV e informe o ID da coleção (ex: simulado-enfermagem).");
                return;
            }

            status.innerText = "Lendo planilha...";
            Papa.parse(input.files[0], {
                header: false,
                skipEmptyLines: true,
                encoding: encodingEscolhido,
                complete: async function(res) {
                    let envios = 0;
                    for (let i = 0; i < res.data.length; i++) {
                        const linha = res.data[i];
                        if (!linha[0] || linha[0].trim() === "") continue;

                        if (i === 0 && linha[0].trim().toLowerCase().includes("enunciado")) {
                            continue;
                        }

                        await db.collection(simId).add({
                            Enunciado: (linha[0] || "").trim(),
                            Alternativa_Correta: (linha[1] || "").trim(),
                            Incorreta_1: (linha[2] || "").trim(),
                            Incorreta_2: (linha[3] || "").trim(),
                            Incorreta_3: (linha[4] || "").trim(),
                            Incorreta_4: (linha[5] || "").trim(),
                            Explicacao: (linha[6] || "").trim(),
                            dificuldade: (linha[7] || "").trim(),
                            assunto: (linha[8] || "").trim(),
                            subsecao: (linha[9] || "").trim(),
                            secao: (linha[10] || "").trim(),
                            capitulo: (linha[11] || "").trim(),
                            modulo: (linha[12] || "").trim(),
                            bloco: (linha[13] || "1").trim()
                        });

                        envios++;
                        status.innerText = `Enviadas ${envios} questões para '${simId}'...`;
                    }

                    // Auto-registra a coleção em simulados_info para aparecer imediatamente no Gerenciador!
                    const nomeExtraido = formatarSufixoSimulado(simId);
                    await db.collection("simulados_info").doc(simId).set({
                        id: simId,
                        colecaoQuestoes: simId,
                        tituloVisivel: nomeExtraido,
                        descricaoVisivel: "Simulado Completo",
                        nome: `${nomeExtraido}: Simulado Completo`,
                        ativo: true
                    }, { merge: true });

                    status.innerText = `✅ Concluído! ${envios} questões salvas em '${simId}' e simulado listado abaixo!`;
                    carregarListasAdmin();
                    inspecionarColecaoSimulado(simId);
                }
            });
        }
