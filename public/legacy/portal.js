/* =========================================================
           1. CONFIGURAÇÃO DO FIREBASE E ESTADO GLOBAL (100% NUVEM)
           ========================================================= */

        const firebaseConfig = {
            apiKey: "AIzaSyBwRtHKkNuNfgeCGL017GaOaOPg45KCPe8",
            authDomain: "materia-education.firebaseapp.com",
            projectId: "materia-education",
            storageBucket: "materia-education.firebasestorage.app",
            messagingSenderId: "110589682387",
            appId: "1:110589682387:web:c047eccea25d1aaaf82a26",
            measurementId: "G-21WCF5GPM6"
        };

    

        firebase.initializeApp(firebaseConfig);
        const db = firebase.firestore();
        const auth = firebase.auth();
        const provider = new firebase.auth.GoogleAuthProvider();

        // Variáveis em memória sincronizadas diretamente com o Firestore
        let usuarioAtual = null; // { uid, nome, email }
        let perfilFirestore = {
            isPremium: false,
            bibliotecaIds: [],
            simuladosAdicionados: [],
            progressoPaginas: {},
        };
        let historicoProvas = [];
        let acaoPendentePosLogin = null;
        let checkoutAtual = { nome: "", valor: "", tipo: "" };

        const cuponsIniciaisPadrao = [
            { id: 'cupom-100-apostila', titulo: '100% de desconto em qualquer apostila, para sempre!', expira: 'nunca', acaoTexto: 'usar', tipo: 'apostila', usado: false },
            { id: 'cupom-1mes-premium', titulo: '1 mês de Matéria premium!', expira: '28 dias', acaoTexto: 'ativar', tipo: 'premium', usado: false }
        ];

        const apostilaPadraoAdmin = {
            id: "admin-default",
            titulo: "Administração",
            subtitulo: "Fundamentos - gestão - estratégia",
            ano: "2026",
            preco: "14,99",
            capaUrl: "capa apostila de administração.jpg",
            pdfUrl: "apostilaadministração.pdf",
            descricao: `<p><strong>Seja muito bem-vindo(a) à nossa apostila de Fundamentos da Administração!</strong></p>
                        <p>Você já parou para pensar em como as grandes empresas conseguem coordenar milhares de funcionários em diferentes países para lançar um produto no mercado exatamente no mesmo dia? Ou como um pequeno empreendedor de bairro consegue organizar suas finanças, gerir seu estoque e encantar seus clientes para não fechar as portas? Por trás de todo o sucesso (ou fracasso) de qualquer iniciativa humana que envolva recursos limitados e objetivos a serem alcançados, existe uma ciência e uma arte chamada Administração.</p>
                        <p>Este material didático foi cuidadosamente desenvolvido para introduzir você, estudante ou profissional em formação, ao fascinante universo corporativo. A Administração não se resume a burocracia ou planilhas complexas; ela trata, essencialmente, da tomada de decisão, da liderança de pessoas e da busca implacável por transformar recursos em resultados reais para a sociedade.</p>`
        };

        /* =========================================================
           2. SINCRONIZAÇÃO DO USUÁRIO COM O FIRESTORE
           ========================================================= */
        async function carregarOuCriarPerfilFirestore(user) {
            const docRef = db.collection("usuarios").doc(user.uid);
            try {
                const doc = await docRef.get();
                if (doc.exists) {
                    const dados = doc.data();
                    perfilFirestore = {
                        isPremium: dados.isPremium || false,
                        bibliotecaIds: dados.bibliotecaIds || ["admin-default"],
                        simuladosAdicionados: dados.simuladosAdicionados || [],
                        progressoPaginas: dados.progressoPaginas || {},
                        cupons: dados.cupons || cuponsIniciaisPadrao
                    };
                } else {
                    perfilFirestore = {
                        nome: user.displayName || "USUÁRIO",
                        email: user.email || "",
                        isPremium: false,
                        bibliotecaIds: [],
                        simuladosAdicionados: [],
                        progressoPaginas: {},
                        cupons: cuponsIniciaisPadrao,
                        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    await docRef.set(perfilFirestore);
                }
            } catch (e) {
                console.error("Erro ao sincronizar perfil com Firestore:", e);
            }

            await carregarHistoricoDoFirestore();
            atualizarEstadoCabecalho();
            renderizarMeusCupons();
            renderizarBibliotecaAluno();
            renderizarSimuladosSalvosNoLobby();
        }

        async function atualizarDadosUsuarioNoFirestore(novosCampos) {
            Object.assign(perfilFirestore, novosCampos);
            if (!usuarioAtual) return;
            try {
                await db.collection("usuarios").doc(usuarioAtual.uid).set(novosCampos, { merge: true });
            } catch (e) {
                console.error("Erro ao atualizar dados do usuário no Firestore:", e);
            }
        }

        async function carregarHistoricoDoFirestore() {
            if (!usuarioAtual) {
                historicoProvas = [];
                renderizarColunaHistorico();
                return;
            }
            try {
                const snap = await db.collection("usuarios").doc(usuarioAtual.uid)
                    .collection("historico")
                    .orderBy("timestamp", "desc")
                    .limit(15)
                    .get();
                historicoProvas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (e) {
                console.error("Erro ao buscar histórico do Firestore:", e);
                historicoProvas = [];
            }
            renderizarColunaHistorico();
        }

        /* =========================================================
           3. NAVEGAÇÃO, AUTENTICAÇÃO E CUPONS
           ========================================================= */
        function mudarSeparador(id) {
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            
            document.getElementById(id).classList.add('active');
            document.querySelectorAll('.nav-btn').forEach(btn => {
                if (btn.getAttribute('onclick').includes(id)) btn.classList.add('active');
            });
            
            document.getElementById('popover-cupons').classList.remove('active');

            if (id === 'apostila') {
                document.querySelectorAll('.subview-apostila').forEach(v => v.classList.remove('active'));
                document.getElementById('sub-catalogo').classList.add('active');
            }
            if (id === 'simulados') {
                document.querySelectorAll('.view-simulado').forEach(v => v.classList.remove('active'));
                document.getElementById('sim-view-lobby').classList.add('active');
            }
            if (id === 'biblioteca') {
                renderizarBibliotecaAluno();
            }
        }

        function abrirModal(id) { document.getElementById(id).classList.add('active'); }
        function fecharModal(id) { document.getElementById(id).classList.remove('active'); }

        function exigirLoginPrimeiro(callbackAcao) {
            if (usuarioAtual) {
                callbackAcao();
            } else {
                acaoPendentePosLogin = callbackAcao;
                abrirModal('modal-auth');
            }
        }

        function loginComGoogle() {
            auth.signInWithPopup(provider).then(() => {
                fecharModal('modal-auth');
            }).catch(err => {
                console.error("Erro no login com Google:", err);
                alert("Não foi possível autenticar com o Google. Tentando modo visitante na nuvem...");
                loginVisitanteRapido();
            });
        }

        function loginVisitanteRapido() {
            auth.signInAnonymously().then(() => {
                fecharModal('modal-auth');
            }).catch(err => {
                console.error("Erro no login anônimo Firebase:", err);
                alert("Verifique se o login Anônimo ou Google estão ativados no painel do Firebase Authentication.");
            });
        }

        function logout() {
            if (confirm("Deseja sair da sua conta?")) {
                auth.signOut();
            }
        }

        auth.onAuthStateChanged(async user => {
            if (user) {
                const primeiroNome = user.displayName ? user.displayName.split(' ')[0].toUpperCase() : 'VISITANTE';
                usuarioAtual = { uid: user.uid, nome: primeiroNome, email: user.email || "" };
                await carregarOuCriarPerfilFirestore(user);

                if (acaoPendentePosLogin) {
                    const acao = acaoPendentePosLogin;
                    acaoPendentePosLogin = null;
                    acao();
                }
            } else {
                usuarioAtual = null;
                perfilFirestore = {
                    isPremium: false,
                    bibliotecaIds: [],
                    simuladosAdicionados: [],
                    progressoPaginas: {},
                    cupons: []
                };
                historicoProvas = [];
                atualizarEstadoCabecalho();
                renderizarMeusCupons();
                renderizarBibliotecaAluno();
                renderizarSimuladosSalvosNoLobby();
                renderizarColunaHistorico();
            }
        });

        function atualizarEstadoCabecalho() {
            const isPremium = perfilFirestore.isPremium === true;
            document.getElementById('btn-banner-premium').style.display = isPremium ? 'none' : 'block';
            document.getElementById('badge-voce-premium').style.display = isPremium ? 'inline-flex' : 'none';

            document.getElementById('btn-entrar-topo').style.display = usuarioAtual ? 'none' : 'inline-flex';
            document.getElementById('btn-usuario-topo').style.display = usuarioAtual ? 'inline-flex' : 'none';
            if (usuarioAtual) {
                document.getElementById('label-nome-usuario').innerText = usuarioAtual.nome;
            }
        }

        /* SISTEMA DE CUPONS (100% FIRESTORE) */
        function togglePopoverCupons() {
            const pop = document.getElementById('popover-cupons');
            pop.classList.toggle('active');
            renderizarMeusCupons();
        }

        function alternarAbaCupom(aba) {
            document.getElementById('tab-btn-inserir').classList.toggle('active', aba === 'inserir');
            document.getElementById('tab-btn-meus').classList.toggle('active', aba === 'meus');
            document.getElementById('conteudo-cupom-inserir').style.display = (aba === 'inserir') ? 'flex' : 'none';
            document.getElementById('conteudo-cupom-meus').style.display = (aba === 'meus') ? 'flex' : 'none';
            if (aba === 'meus') renderizarMeusCupons();
        }

        async function confirmarCodigoCupom() {
            const input = document.getElementById('input-codigo-cupom');
            const codigo = input.value.trim().toUpperCase();
            if (!codigo) return;

            exigirLoginPrimeiro(async () => {
                const novaListaCupons = [...(perfilFirestore.cupons || [])];

                if (codigo === 'PREMIUM' || codigo === 'MATERIA30') {
                    novaListaCupons.unshift({
                        id: 'cupom-' + Date.now(),
                        titulo: '1 mês de Matéria premium!',
                        expira: '28 dias',
                        acaoTexto: 'ativar',
                        tipo: 'premium',
                        usado: false
                    });
                } else {
                    novaListaCupons.unshift({
                        id: 'cupom-' + Date.now(),
                        titulo: `100% de desconto em qualquer apostila (${codigo})!`,
                        expira: 'nunca',
                        acaoTexto: 'usar',
                        tipo: 'apostila',
                        usado: false
                    });
                }

                await atualizarDadosUsuarioNoFirestore({ cupons: novaListaCupons });
                input.value = '';
                alternarAbaCupom('meus');
            });
        }

        function renderizarMeusCupons() {
            const container = document.getElementById('lista-meus-cupons-DOM');
            if (!usuarioAtual) {
                container.innerHTML = `<p style="text-align:center; font-size:13px; color:#666;">Faça login para visualizar seus cupons salvos na nuvem.</p>`;
                return;
            }

            const disponiveis = (perfilFirestore.cupons || []).filter(c => !c.usado);
            if (disponiveis.length === 0) {
                container.innerHTML = `<p style="text-align:center; font-size:13px; color:#666;">Nenhum cupom disponível no momento.</p>`;
                return;
            }
            container.innerHTML = disponiveis.map(c => `
                <div class="card-meu-cupom">
                    <h5>${c.titulo}</h5>
                    <div class="expira-texto">expira em: ${c.expira}</div>
                    <button class="btn-usar-cupom-full" onclick="executarAcaoCupom('${c.id}')">${c.acaoTexto}</button>
                </div>
            `).join('');
        }

let aguardandoEscolherApostilaParaCupom = false;
        let idCupomPendenteParaApostila = null;

        function cancelarModoEscolhaCupom() {
            aguardandoEscolherApostilaParaCupom = false;
            idCupomPendenteParaApostila = null;
            const banner = document.getElementById('banner-escolha-apostila-cupom');
            if (banner) banner.style.display = 'none';
        }

        function abrirPopoverCupomPelaApostila() {
            const pop = document.getElementById('popover-cupons');
            pop.classList.add('active');
            alternarAbaCupom('meus');
            renderizarMeusCupons();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function verificarSeEstaNaPaginaDetalheApostila() {
            const abaApostilaAtiva = document.getElementById('apostila').classList.contains('active');
            const subDetalheAtiva = document.getElementById('sub-detalhe').classList.contains('active');
            return abaApostilaAtiva && subDetalheAtiva;
        }

        async function executarAcaoCupom(idCupom) {
            const lista = [...(perfilFirestore.cupons || [])];
            const cupom = lista.find(c => c.id === idCupom);
            if (!cupom) return;

            document.getElementById('popover-cupons').classList.remove('active');

            if (cupom.tipo === 'premium') {
                cupom.usado = true;
                await atualizarDadosUsuarioNoFirestore({ cupons: lista, isPremium: true });
                atualizarEstadoCabecalho();
                // Se estiver com uma apostila aberta, já some o preço 14,99 na hora
                if (verificarSeEstaNaPaginaDetalheApostila()) {
                    abrirDetalheApostilaPorId(apostilaSelecionada.id, false);
                }
                alert("🎉 1 mês de Matéria Premium ativado com sucesso! Todas as apostilas estão liberadas sem custo.");
            } else {
                // Cupom de Apostila Grátis
                idCupomPendenteParaApostila = idCupom;

                if (verificarSeEstaNaPaginaDetalheApostila()) {
                    // Já está na página de uma apostila -> abre o pop-up de confirmação direto para ela
                    abrirPopupConfirmacaoCupomApostila();
                } else {
                    // Não está na página da apostila -> leva para o catálogo para o aluno escolher uma
                    aguardandoEscolherApostilaParaCupom = true;
                    mudarSeparador('apostila');
                    const banner = document.getElementById('banner-escolha-apostila-cupom');
                    if (banner) banner.style.display = 'flex';
                }
            }
        }

        function abrirPopupConfirmacaoCupomApostila() {
            document.getElementById('texto-confirma-cupom-apostila').innerText = 
                `Deseja usar seu cupom de 100% de desconto na apostila de\n"${apostilaSelecionada.titulo}"?`;
            abrirModal('modal-confirm-cupom-apostila');
        }

        async function confirmarResgateCupomNaApostila() {
            fecharModal('modal-confirm-cupom-apostila');
            exigirLoginPrimeiro(async () => {
                const listaCupons = [...(perfilFirestore.cupons || [])];
                let cupomAlvo = listaCupons.find(c => c.id === idCupomPendenteParaApostila && !c.usado);
                if (!cupomAlvo) {
                    cupomAlvo = listaCupons.find(c => c.tipo === 'apostila' && !c.usado);
                }

                if (!cupomAlvo) {
                    alert("Você não possui um cupom de apostila disponível no momento.");
                    return;
                }

                cupomAlvo.usado = true;
                const novaBib = Array.from(new Set([...(perfilFirestore.bibliotecaIds || []), apostilaSelecionada.id]));
                await atualizarDadosUsuarioNoFirestore({ cupons: listaCupons, bibliotecaIds: novaBib });

                cancelarModoEscolhaCupom();
                renderizarMeusCupons();
                abrirDetalheApostilaPorId(apostilaSelecionada.id, true);
                alert(`🎉 Apostila "${apostilaSelecionada.titulo}" desbloqueada gratuitamente e adicionada à sua Biblioteca!`);
            });
        }

        /* =========================================================
           4. APOSTILAS, CHECKOUT, PAYWALL E LEITOR DE PDF
           ========================================================= */
        let catalogoApostilas = [];
        let apostilaSelecionada = null;
        let filtroApostilaAtivo = "";

        async function carregarApostilasDoFirebase() {
            try {
                const snap = await db.collection("apostilas").get();
                if (!snap.empty) {
                    // Mostra apenas as apostilas que não estão ocultas pelo Admin
                    catalogoApostilas = snap.docs
                        .map(doc => ({ id: doc.id, ...doc.data() }))
                        .filter(ap => ap.ativo !== false);
                } else {
                    catalogoApostilas = [];
                }
            } catch (e) {
                console.error("Erro ao carregar apostilas do Firestore:", e);
                catalogoApostilas = [];
            }
            renderizarCatalogoApostilas();
            renderizarBibliotecaAluno();
        }

        function executarBuscaInicial() {
            const termo = document.getElementById('input-busca-home').value.trim();
            mudarSeparador('apostila');
            if (termo) aplicarTagApostila(termo);
        }

        function togglePopoverFiltroApostila() {
            document.getElementById('popover-filtro-apostila').classList.toggle('active');
        }

        function aplicarTagApostila(tag) {
            filtroApostilaAtivo = tag;
            document.getElementById('texto-chip-apostila').innerText = tag;
            document.getElementById('chip-filtro-apostila').style.display = 'inline-flex';
            document.getElementById('popover-filtro-apostila').classList.remove('active');
            renderizarCatalogoApostilas();
        }

        function limparFiltroApostila() {
            filtroApostilaAtivo = "";
            document.getElementById('input-pesquisa-apostila').value = "";
            document.getElementById('chip-filtro-apostila').style.display = 'none';
            renderizarCatalogoApostilas();
        }

        function renderizarCatalogoApostilas() {
            const grid = document.getElementById('grid-catalogo-apostilas');
            const termo = (document.getElementById('input-pesquisa-apostila').value || filtroApostilaAtivo).toLowerCase();
            
            const filtradas = catalogoApostilas.filter(ap => 
                ap.titulo.toLowerCase().includes(termo) || 
                ap.subtitulo.toLowerCase().includes(termo)
            );

            grid.innerHTML = filtradas.map(ap => `
                <div class="card-apostila" onclick="abrirDetalheApostilaPorId('${ap.id}', false)">
                    <img src="${ap.capaUrl || 'capa apostila de administração.jpg'}" onerror="this.onerror=null; this.src='capa apostila de administração_2.jpg';" alt="${ap.titulo}">
                    <h3>${ap.titulo}</h3>
                    <p>${ap.subtitulo}</p>
                </div>
            `).join('');
        }

        function renderizarBibliotecaAluno() {
            const gridBib = document.getElementById('grid-biblioteca-aluno');
            const idsAdquiridos = perfilFirestore.bibliotecaIds || ["admin-default"];
            const listaBib = catalogoApostilas.filter(ap => idsAdquiridos.includes(ap.id));

            if (listaBib.length === 0) {
                gridBib.innerHTML = `<p style="grid-column: 1/-1; text-align:center;">Você ainda não possui apostilas na sua biblioteca.</p>`;
                return;
            }

            gridBib.innerHTML = listaBib.map(ap => `
                <div class="card-apostila" onclick="mudarSeparador('apostila'); abrirDetalheApostilaPorId('${ap.id}', true);">
                    <img src="${ap.capaUrl}" onerror="this.onerror=null; this.src='capa apostila de administração_2.jpg';" alt="${ap.titulo}">
                    <h3>${ap.titulo}</h3>
                    <p>${ap.subtitulo}</p>
                </div>
            `).join('');
        }

        function abrirDetalheApostilaPorId(idApostila, isVindoDaBiblioteca) {
            apostilaSelecionada = catalogoApostilas.find(a => a.id === idApostila) || apostilaPadraoAdmin;
            document.querySelectorAll('.subview-apostila').forEach(v => v.classList.remove('active'));
            document.getElementById('sub-detalhe').classList.add('active');

            const banner = document.getElementById('banner-escolha-apostila-cupom');
            if (banner) banner.style.display = 'none';

            document.getElementById('detalhe-img-capa').src = apostilaSelecionada.capaUrl || 'capa apostila de administração.jpg';
            document.getElementById('detalhe-box-descricao').innerHTML = apostilaSelecionada.descricao || apostilaPadraoAdmin.descricao;
            document.getElementById('detalhe-titulo-card').innerText = apostilaSelecionada.titulo;
            document.getElementById('detalhe-sub-card').innerText = apostilaSelecionada.subtitulo;
            document.getElementById('detalhe-ano-card').innerText = apostilaSelecionada.ano || '2026';

            const jaNaBiblioteca = (perfilFirestore.bibliotecaIds || []).includes(apostilaSelecionada.id);
            const temAcessoLiberado = isVindoDaBiblioteca || perfilFirestore.isPremium === true || jaNaBiblioteca;

            const spanPreco = document.getElementById('detalhe-preco-card');
            const btnCupom = document.getElementById('btn-tenho-cupom-apostila');
            const btnTeste = document.getElementById('btn-teste-20-paginas');

            if (temAcessoLiberado) {
                // Usuário Premium ou já dono da apostila: esconde "(14,99)", botão cupom e botão teste
                spanPreco.style.display = 'none';
                btnCupom.style.display = 'none';
                btnTeste.style.display = 'none';
            } else {
                // Usuário Free que ainda não tem a apostila: mostra "(14,99)", botão cupom e botão teste
                spanPreco.style.display = 'block';
                spanPreco.innerText = `(${apostilaSelecionada.preco || '14,99'})`;
                btnCupom.style.display = 'block';
                btnTeste.style.display = 'flex';
            }

            // Se o usuário veio do catálogo após clicar em "usar cupom", abre o pop-up de confirmação automaticamente!
            if (aguardandoEscolherApostilaParaCupom && !temAcessoLiberado) {
                aguardandoEscolherApostilaParaCupom = false;
                abrirPopupConfirmacaoCupomApostila();
            }
        }

        function voltarParaCatalogo() {
            document.querySelectorAll('.subview-apostila').forEach(v => v.classList.remove('active'));
            document.getElementById('sub-catalogo').classList.add('active');
        }

        function irParaSimuladoDaApostila() {
            mudarSeparador('simulados');
        }

        function fluxoClicarLerApostila() {
            const jaNaBiblioteca = (perfilFirestore.bibliotecaIds || []).includes(apostilaSelecionada.id);
            const temAcessoLiberado = perfilFirestore.isPremium === true || jaNaBiblioteca;

            if (temAcessoLiberado) {
                // Se for Premium ou já comprou/resgatou, abre o PDF completo direto sem barreira!
                iniciarLeituraPDF(false);
            } else {
                exigirLoginPrimeiro(() => {
                    abrirCheckoutPagamento(`Apostila: ${apostilaSelecionada.titulo}`, apostilaSelecionada.preco || '14,99', 'apostila');
                });
            }
        }

        function fluxoClicarTeste20Paginas() {
            exigirLoginPrimeiro(() => {
                iniciarLeituraPDF(true);
            });
        }

        function fluxoUsarCupomNaApostila() {
            exigirLoginPrimeiro(() => {
                const listaCupons = [...(perfilFirestore.cupons || [])];
                const cupomApostila = listaCupons.find(c => c.tipo === 'apostila' && !c.usado);
                if (cupomApostila) {
                    idCupomPendenteParaApostila = cupomApostila.id;
                    abrirPopupConfirmacaoCupomApostila();
                } else {
                    abrirPopoverCupomPelaApostila();
                }
            });
        }

        function abrirCheckoutPagamento(nomeItem, valorItem, tipoItem) {
            fecharModal('modal-premium');
            checkoutAtual = { nome: nomeItem, valor: valorItem, tipo: tipoItem };
            document.getElementById('item-checkout-nome').innerText = nomeItem;
            document.getElementById('item-checkout-valor').innerText = `R$ ${valorItem}`;
            abrirModal('modal-pagamento');
        }

        async function concluirPagamentoCheckout() {
            fecharModal('modal-pagamento');
            if (checkoutAtual.tipo === 'premium') {
                await atualizarDadosUsuarioNoFirestore({ isPremium: true });
                atualizarEstadoCabecalho();
                if (verificarSeEstaNaPaginaDetalheApostila() && apostilaSelecionada) {
                    abrirDetalheApostilaPorId(apostilaSelecionada.id, false);
                }
                alert("👑 Assinatura Matéria Premium confirmada e salva na nuvem!");
            } else {
                const novaBib = Array.from(new Set([...(perfilFirestore.bibliotecaIds || []), apostilaSelecionada.id]));
                await atualizarDadosUsuarioNoFirestore({ bibliotecaIds: novaBib });
                abrirDetalheApostilaPorId(apostilaSelecionada.id, true);
                iniciarLeituraPDF(false);
            }
        }
        /* MOTOR DO LEITOR DE PDF (COM PROGRESSO DE PÁGINA NO FIRESTORE) */
        let pdfDoc = null, pageNum = 1;
        let pageIsRendering = false, pageNumIsPending = null, modoAmostraGratis = false;
        const scale = 3, canvas = document.getElementById('pdf-render'), ctx = canvas.getContext('2d');

        async function iniciarLeituraPDF(apenasTeste20Paginas) {
            const idAtual = apostilaSelecionada.id || "admin-default";

            if (!apenasTeste20Paginas && !(perfilFirestore.bibliotecaIds || []).includes(idAtual)) {
                const novaBib = [...(perfilFirestore.bibliotecaIds || []), idAtual];
                await atualizarDadosUsuarioNoFirestore({ bibliotecaIds: novaBib });
                renderizarBibliotecaAluno();
            }

            modoAmostraGratis = apenasTeste20Paginas;
            document.getElementById('aviso-modo-teste').style.display = modoAmostraGratis ? 'inline-block' : 'none';
            
            pageNum = (perfilFirestore.progressoPaginas && perfilFirestore.progressoPaginas[idAtual]) ? perfilFirestore.progressoPaginas[idAtual] : 1;
            if (modoAmostraGratis && pageNum > 20) pageNum = 1;

            document.querySelectorAll('.subview-apostila').forEach(v => v.classList.remove('active'));
            document.getElementById('sub-leitor').classList.add('active');

            const arquivoPDFOriginal = apostilaSelecionada.pdfUrl || 'apostilaadministração.pdf';
            let arquivoPDF = arquivoPDFOriginal;
            try {
                const urlPDF = new URL(arquivoPDFOriginal, window.location.href);
                const ambienteLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
                if (ambienteLocal && urlPDF.hostname === 'bahvila.userguilhermeavila05.workers.dev') {
                    arquivoPDF = `/pdf-origin${urlPDF.pathname}${urlPDF.search}`;
                }
            } catch (e) {
                console.error('URL do PDF inválida:', e);
            }
            pdfjsLib.getDocument(arquivoPDF).promise.then(doc => {
                pdfDoc = doc;
                document.getElementById('page-count').textContent = doc.numPages;
                renderizarPaginaPDF(pageNum);
            }).catch(err => {
                console.error("Erro no PDF:", err);
                alert('Não foi possível carregar esta apostila. Verifique a URL do PDF e a configuração de CORS do servidor.');
            });
        }

        function renderizarPaginaPDF(num) {
            pageIsRendering = true;
            pdfDoc.getPage(num).then(page => {
                const viewport = page.getViewport({ scale });
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                page.render({ canvasContext: ctx, viewport }).promise.then(() => {
                    pageIsRendering = false;
                    if (pageNumIsPending !== null) {
                        renderizarPaginaPDF(pageNumIsPending);
                        pageNumIsPending = null;
                    }
                }).catch(err => {
                    pageIsRendering = false;
                    console.error('Erro ao desenhar a página do PDF:', err);
                });
                document.getElementById('page-num').textContent = num;

                // Salva a página atual do aluno no Firestore
                if (usuarioAtual && apostilaSelecionada) {
                    const mapaPaginas = { ...(perfilFirestore.progressoPaginas || {}), [apostilaSelecionada.id]: num };
                    atualizarDadosUsuarioNoFirestore({ progressoPaginas: mapaPaginas });
                }
            }).catch(err => {
                pageIsRendering = false;
                console.error('Erro ao obter a página do PDF:', err);
            });
        }

        function mudarPaginaPDF(direcao) {
            if (!pdfDoc) return;
            if (direcao === -1 && pageNum <= 1) return;

            if (direcao === 1 && modoAmostraGratis && pageNum >= 20) {
                abrirModal('modal-paywall');
                return;
            }
            if (direcao === 1 && pageNum >= pdfDoc.numPages) return;

            pageNum += direcao;
            if (pageIsRendering) pageNumIsPending = pageNum;
            else renderizarPaginaPDF(pageNum);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function fecharLeitorPDF() {
            document.querySelectorAll('.subview-apostila').forEach(v => v.classList.remove('active'));
            document.getElementById('sub-detalhe').classList.add('active');
        }

        /* =========================================================
           5. SIMULADOS (CATÁLOGO, LOBBY, EXECUÇÃO E GABARITO)
           ========================================================= */
        let listaSimuladosDisponiveis = [];
        let simuladoPendente = null;
        let idSimuladoParaRemover = null;
        let simuladoAtivoNome = "Administração";
        let simuladoAtivoId = "administracao-geral";
        let simuladoAtivoMetadata = { questoes_banca: 20, tempo_banca: 60 };
        let listaQuestoes = [];
        let questaoAtualIndex = 0;
        let respostasUsuario = [];
        let configSimulado = { questoes: 20, tempo: 3600, feedback: false, minutosOriginais: 60 };
        let relogioIntervalo = null;
        let tempoSegundos = 0;
        const letrasAlternativas = ['A', 'B', 'C', 'D', 'E'];

        async function carregarSimuladosDoFirebase() {
            try {
                const snap = await db.collection("simulados_info").get();
                if (!snap.empty) {
                    // Mostra apenas os simulados que não estão ocultos pelo Admin
                    listaSimuladosDisponiveis = snap.docs
                        .map(doc => ({ id: doc.id, ...doc.data() }))
                        .filter(sim => sim.ativo !== false);
                } else {
                    listaSimuladosDisponiveis = [];
                }
                renderizarListaSimulados();
                renderizarSimuladosSalvosNoLobby();
            } catch (e) {
                console.error("Erro ao carregar simulados do banco:", e);
            }
        }

        function extrairAreaAssunto(nomeOriginal) {
            let partes = (nomeOriginal || "Simulado").split(/[:\-]/);
            let area = partes[0].trim();
            let assunto = partes.length > 1 ? partes.slice(1).join('-').trim() : "";
            let areaLimpa = area.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '');
            return { area, assunto, areaLimpa };
        }

        function abrirCatalogoSimulados() {
            document.querySelectorAll('.view-simulado').forEach(v => v.classList.remove('active'));
            document.getElementById('sim-view-catalogo').classList.add('active');
            renderizarListaSimulados();
        }

        function voltarParaLobbySimulado() {
            document.querySelectorAll('.view-simulado').forEach(v => v.classList.remove('active'));
            document.getElementById('sim-view-lobby').classList.add('active');
        }

        function abrirTelaHistorico() {
            document.querySelectorAll('.view-simulado').forEach(v => v.classList.remove('active'));
            document.getElementById('sim-view-historico').classList.add('active');
            carregarHistoricoDoFirestore();
        }

        function renderizarListaSimulados() {
            const container = document.getElementById('grid-catalogo-simulados');
            if (!container) return;

            const termo = (document.getElementById('input-busca-catalogo-simulado').value || "").toLowerCase();
            const filtrados = listaSimuladosDisponiveis.filter(sim => (sim.nome || "").toLowerCase().includes(termo));
            
            container.innerHTML = filtrados.map(sim => {
                const info = extrairAreaAssunto(sim.nome);
                const imagemExibir = sim.capaUrl ? sim.capaUrl : `capasimulado${info.areaLimpa}.png`;

                return `
                <div class="card-simulado-banner" onclick="pedirAdicionarSimulado('${sim.nome}', '${sim.id}')" style="margin-bottom: 15px;">
                    <div class="info">
                        <h2>${info.area}</h2>
                        <p>${info.assunto}</p>
                    </div>
                    <img src="${imagemExibir}" class="capa" onerror="this.style.display='none'">
                </div>`;
            }).join('');
        }

        function pedirAdicionarSimulado(nome, id) {
            exigirLoginPrimeiro(() => {
                const info = extrairAreaAssunto(nome);
                simuladoPendente = { nome, id, area: info.area, assunto: info.assunto, areaLimpa: info.areaLimpa };
                document.getElementById('texto-confirma-add').innerText = `Adicionar simulado de\n${info.area}: ${info.assunto}?`;
                abrirModal('modal-confirm-add');
            });
        }

        async function confirmarAddSimulado() {
            fecharModal('modal-confirm-add');
            if (!simuladoPendente) return;

            const listaAtual = [...(perfilFirestore.simuladosAdicionados || [])];
            if (!listaAtual.some(s => s.id === simuladoPendente.id)) {
                listaAtual.push(simuladoPendente);
                await atualizarDadosUsuarioNoFirestore({ simuladosAdicionados: listaAtual });
            }
            renderizarSimuladosSalvosNoLobby();
            voltarParaLobbySimulado();
        }

        function renderizarSimuladosSalvosNoLobby() {
            const container = document.getElementById('container-simulado-criado');
            if (!container) return;

            const salvos = perfilFirestore.simuladosAdicionados || [];
            if (salvos.length === 0) {
                container.innerHTML = `<p style="color:#666; font-weight:600;">Nenhum simulado adicionado ao seu painel. Clique em <strong>NOVO SIMULADO +</strong> para escolher.</p>`;
                return;
            }

            container.innerHTML = salvos.map(sim => {
                const simBanco = listaSimuladosDisponiveis.find(s => s.id === sim.id);
                const imagemExibir = (simBanco && simBanco.capaUrl) ? simBanco.capaUrl : `capasimulado${sim.areaLimpa}.png`;

                return `
                <div class="linha-lobby-banner">
                    <div class="card-simulado-banner" onclick="fluxoClicarSimuladoParaConfigurar('${sim.nome}', '${sim.id}')" style="margin-bottom: 0;">
                        <div class="info">
                            <h2>${sim.area}</h2>
                            <p>${sim.assunto}</p>
                            <div class="link-materiais-yellow" onclick="event.stopPropagation(); mudarSeparador('apostila'); abrirDetalheApostilaPorId('admin-default', false);">
                                Materiais recomendados ↗
                            </div>
                        </div>
                        <img src="${imagemExibir}" class="capa" onerror="this.style.display='none'">
                    </div>
                    <button class="btn-excluir-lateral" title="Excluir" onclick="pedirRemoverSimulado(event, '${sim.id}', '${sim.area}', '${sim.assunto}')">
                        <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                </div>`;
            }).join('');
        }

        function pedirRemoverSimulado(event, idSimulado, area, assunto) {
            event.stopPropagation();
            idSimuladoParaRemover = idSimulado;
            document.getElementById('texto-confirma-remove').innerText = `Remover simulado de\n${area}: ${assunto}?`;
            abrirModal('modal-confirm-remove');
        }

        async function confirmarRemoveSimulado() {
            fecharModal('modal-confirm-remove');
            if (idSimuladoParaRemover) {
                const novaLista = (perfilFirestore.simuladosAdicionados || []).filter(s => s.id !== idSimuladoParaRemover);
                await atualizarDadosUsuarioNoFirestore({ simuladosAdicionados: novaLista });
                idSimuladoParaRemover = null;
                renderizarSimuladosSalvosNoLobby();
            }
        }

        function fluxoClicarSimuladoParaConfigurar(nomeClicado, idClicado) {
            if (nomeClicado) simuladoAtivoNome = nomeClicado;
            if (idClicado) simuladoAtivoId = idClicado;

            exigirLoginPrimeiro(async () => {
                document.getElementById('titulo-config-modal').innerText = simuladoAtivoNome;
                
                try {
                    let doc = await db.collection("simulados_info").doc(simuladoAtivoId).get();
                    if (doc.exists) {
                        simuladoAtivoMetadata = doc.data();
                    } else {
                        simuladoAtivoMetadata = { questoes_banca: 20, tempo_banca: 60 };
                    }
                } catch (e) {
                    simuladoAtivoMetadata = { questoes_banca: 20, tempo_banca: 60 };
                }

                document.getElementById('txt-banca-questoes').innerHTML = `<strong>${simuladoAtivoMetadata.questoes_banca || 20} Questões</strong> aleatórias`;
                document.getElementById('txt-banca-tempo').innerHTML = `Tempo de <strong>${simuladoAtivoMetadata.tempo_banca || 60} min</strong>`;

                abrirModal('modal-config-simulado');
            });
        }

        async function iniciarExecucaoSimulado(modo) {
            fecharModal('modal-config-simulado');

            if (modo === 'banca') {
                const qBanca = simuladoAtivoMetadata.questoes_banca || 20;
                const tBanca = simuladoAtivoMetadata.tempo_banca || 60;
                configSimulado = { questoes: qBanca, tempo: tBanca * 60, feedback: false, minutosOriginais: tBanca };
            } else {
                const qtd = parseInt(document.getElementById('cfg-qtd-questoes').value) || 10;
                const min = parseInt(document.getElementById('cfg-tempo-prova').value) || 0;
                const fbk = document.getElementById('cfg-gabarito-imediato').checked;
                configSimulado = { questoes: qtd, tempo: min * 60, feedback: fbk, minutosOriginais: min };
            }

            document.querySelectorAll('.view-simulado').forEach(v => v.classList.remove('active'));
            document.getElementById('sim-view-prova').classList.add('active');
            document.getElementById('enunciado-questao-prova').innerText = "Carregando questões do banco de dados Firebase...";
            document.getElementById('lista-alternativas-prova').innerHTML = "";
            respostasUsuario = [];

            try {
                // Busca direto na coleção com o ID do simulado (criada pelo Painel Admin)
                let snapshot = await db.collection(simuladoAtivoId).get();
                let todas = snapshot.docs.map(doc => doc.data());

                // Fallback caso ainda haja questões na estrutura antiga
                if (todas.length === 0) {
                    let snapGeral = await db.collection("questoes").where("simuladoId", "==", simuladoAtivoId).get();
                    todas = snapGeral.docs.map(doc => doc.data());
                }

                if (todas.length === 0) {
                    alert("Este simulado ainda não possui questões cadastradas no banco de dados!");
                    voltarParaLobbySimulado();
                    return;
                }

                todas.sort(() => Math.random() - 0.5);
                listaQuestoes = todas.slice(0, Math.min(configSimulado.questoes, todas.length));
            } catch (e) {
                console.error("Erro ao carregar questões:", e);
                alert("Erro de conexão com o banco de dados.");
                voltarParaLobbySimulado();
                return;
            }
            mostrarQuestaoProva(0);
            iniciarCronometroProva();
        }

        function desenharPaginacaoTopoProva() {
            const container = document.getElementById('barra-paginacao-prova');
            container.innerHTML = listaQuestoes.map((_, i) => {
                let classe = "quadrado-num";
                if (i === questaoAtualIndex) classe += " atual";
                else if (respostasUsuario[i] && respostasUsuario[i].respondida && configSimulado.feedback) {
                    classe += respostasUsuario[i].acertou ? " verde" : " vermelho";
                } else if (respostasUsuario[i] && respostasUsuario[i].respondida) {
                    classe += " cinza";
                }
                return `<div class="${classe}" onclick="mostrarQuestaoProva(${i})">${i + 1}</div>`;
            }).join('');
        }

        function mostrarQuestaoProva(index) {
            questaoAtualIndex = index;
            desenharPaginacaoTopoProva();

            const q = listaQuestoes[index];
            document.getElementById('titulo-questao-prova').innerText = `Questão ${index + 1}`;
            document.getElementById('enunciado-questao-prova').innerText = q.Enunciado || q.enunciado || "Enunciado indisponível.";
            
            if (!respostasUsuario[index]) {
                let opcoes = [
                    { texto: q.Alternativa_Correta || q.Correta || q.correta, tipo: 'correta' },
                    { texto: q.Incorreta_1 || q.incorreta_1 || q.Incorreta1, tipo: 'incorreta' },
                    { texto: q.Incorreta_2 || q.incorreta_2 || q.Incorreta2, tipo: 'incorreta' },
                    { texto: q.Incorreta_3 || q.incorreta_3 || q.Incorreta3, tipo: 'incorreta' },
                    { texto: q.Incorreta_4 || q.incorreta_4 || q.Incorreta4, tipo: 'incorreta' }
                ].filter(alt => alt.texto && alt.texto.trim() !== "");

                opcoes.sort(() => Math.random() - 0.5);
                respostasUsuario[index] = {
                    questaoOriginal: q,
                    respondida: false,
                    acertou: false,
                    indiceEscolhido: null,
                    textoEscolhido: null,
                    ordemExibida: opcoes
                };
            }

            const estado = respostasUsuario[index];
            const containerAlts = document.getElementById('lista-alternativas-prova');

            containerAlts.innerHTML = estado.ordemExibida.map((alt, i) => {
                let classeBtn = "btn-alternativa-borda";
                let desativado = "";

                if (estado.respondida) {
                    if (!configSimulado.feedback) {
                        if (estado.indiceEscolhido === i) classeBtn += " selecionada";
                    } else {
                        desativado = "disabled";
                        if (alt.tipo === 'correta') classeBtn += " correta";
                        else if (estado.indiceEscolhido === i && !estado.acertou) classeBtn += " incorreta";
                    }
                }

                return `
                    <div class="item-alternativa-linha">
                        <div class="letra-fora">${letrasAlternativas[i]})</div>
                        <button class="${classeBtn}" ${desativado} onclick="assinalarAlternativa(${i})">${alt.texto}</button>
                    </div>
                `;
            }).join('');

            const btnAvancar = document.getElementById('btn-avancar-questao');
            if (index + 1 === listaQuestoes.length) {
                btnAvancar.innerHTML = `Finalizar<br><span style="font-size:24px;">✔</span>`;
            } else {
                btnAvancar.innerHTML = `Próximo<br><span>▶</span>`;
            }
        }

        function assinalarAlternativa(idx) { 
            const estado = respostasUsuario[questaoAtualIndex]; 
            estado.respondida = true; 
            estado.indiceEscolhido = idx; 
            estado.textoEscolhido = estado.ordemExibida[idx].texto; 
            estado.acertou = (estado.ordemExibida[idx].tipo === 'correta'); 
            mostrarQuestaoProva(questaoAtualIndex); 
        }

        function navegarQuestaoAnterior() {
            if (questaoAtualIndex > 0) mostrarQuestaoProva(questaoAtualIndex - 1);
        }

        function avancarOuFinalizarSimulado() {
            if (questaoAtualIndex + 1 < listaQuestoes.length) {
                mostrarQuestaoProva(questaoAtualIndex + 1);
            } else {
                finalizarSimulado();
            }
        }

        function iniciarCronometroProva() {
            if (relogioIntervalo) clearInterval(relogioIntervalo);
            const visor = document.getElementById('visor-relogio-prova');
            if (configSimulado.tempo <= 0) {
                visor.innerText = "LIVRE";
                return;
            }
            tempoSegundos = configSimulado.tempo;
            atualizarTextoRelogio(visor);

            relogioIntervalo = setInterval(() => {
                tempoSegundos--;
                atualizarTextoRelogio(visor);
                if (tempoSegundos <= 0) {
                    clearInterval(relogioIntervalo);
                    finalizarSimulado();
                }
            }, 1000);
        }

        function atualizarTextoRelogio(visor) {
            const m = Math.floor(tempoSegundos / 60);
            const s = tempoSegundos % 60;
            visor.innerText = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
        }

        function abandonarSimulado() {
            if (confirm("Deseja desistir do simulado atual?")) {
                if (relogioIntervalo) clearInterval(relogioIntervalo);
                voltarParaLobbySimulado();
            }
        }

        /* =========================================================
           6. GABARITO E HISTÓRICO (SALVO NO FIRESTORE)
           ========================================================= */
        async function finalizarSimulado() {
            if (relogioIntervalo) clearInterval(relogioIntervalo);

            let totalAcertos = 0;
            listaQuestoes.forEach((q, i) => {
                if (!respostasUsuario[i]) {
                    let opcoes = [
                        { texto: q.Alternativa_Correta || q.Correta || q.correta, tipo: 'correta' },
                        { texto: q.Incorreta_1 || q.incorreta_1, tipo: 'incorreta' },
                        { texto: q.Incorreta_2 || q.incorreta_2, tipo: 'incorreta' },
                        { texto: q.Incorreta_3 || q.incorreta_3, tipo: 'incorreta' },
                        { texto: q.Incorreta_4 || q.incorreta_4, tipo: 'incorreta' }
                    ].filter(a => a.texto && a.texto.trim() !== "");
                    respostasUsuario[i] = { questaoOriginal: q, respondida: false, acertou: false, indiceEscolhido: null, ordemExibida: opcoes };
                }
                if (respostasUsuario[i].respondida && respostasUsuario[i].acertou) totalAcertos++;
            });

            const hoje = new Date().toLocaleDateString('pt-BR');
            const notaBase10 = ((totalAcertos / listaQuestoes.length) * 10).toFixed(1).replace('.', ',');
            const novoRegisto = {
                data: hoje,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                titulo: simuladoAtivoNome,
                simuladoId: simuladoAtivoId,
                qtdQuestoes: listaQuestoes.length,
                tempoMinutos: configSimulado.minutosOriginais || 10,
                notaFormatada: `${notaBase10}/10`,
                respostasSalvas: respostasUsuario,
                questoesSalvas: listaQuestoes
            };

            if (usuarioAtual) {
                try {
                    await db.collection("usuarios").doc(usuarioAtual.uid).collection("historico").add(novoRegisto);
                    await carregarHistoricoDoFirestore();
                } catch (e) {
                    console.error("Erro ao salvar histórico no Firestore:", e);
                }
            }

            abrirRevisaoModal(respostasUsuario, totalAcertos, listaQuestoes.length);
        }

        function abrirRevisaoModal(respostas, acertos, total) {
            const barraBlocos = document.getElementById('barra-blocos-resultado');
            barraBlocos.innerHTML = respostas.map((r, i) => {
                const classeCor = r.respondida ? (r.acertou ? "verde" : "vermelho") : "vermelho";
                return `<div class="quadrado-num ${classeCor}" onclick="inspecionarQuestaoNoResultado(${i})">${i + 1}</div>`;
            }).join('');

            document.getElementById('nota-final-resultado').innerText = `${acertos}/${total}`;
            inspecionarQuestaoNoResultado(0);
            
            document.querySelectorAll('.view-simulado').forEach(v => v.classList.remove('active'));
            document.getElementById('sim-view-resultado').classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function inspecionarQuestaoNoResultado(index) {
            const r = respostasUsuario[index];
            const q = r.questaoOriginal;
            let letraCorreta = "A";

            const htmlAlternativas = r.ordemExibida.map((alt, i) => {
                let classe = "btn-alternativa-borda";
                if (alt.tipo === 'correta') {
                    classe += " correta";
                    letraCorreta = letrasAlternativas[i];
                } else if (r.respondida && r.indiceEscolhido === i && !r.acertou) {
                    classe += " incorreta";
                }

                return `
                    <div class="item-alternativa-linha">
                        <div class="letra-fora">${letrasAlternativas[i]})</div>
                        <div class="${classe}" style="cursor:default;">${alt.texto}</div>
                    </div>
                `;
            }).join('');

            document.getElementById('revisao-questao-esquerda').innerHTML = `
                <h2 style="margin:0 0 12px 0; font-size:24px;">Questão ${index + 1}</h2>
                <p style="font-size:14.5px; line-height:1.6; margin-bottom:20px;">${q.Enunciado || q.enunciado}</p>
                ${htmlAlternativas}
            `;

            document.getElementById('revisao-letra-correta').innerText = `Alternativa correta: ${letraCorreta}`;
            document.getElementById('revisao-texto-justificativa').innerText = q.Explicacao || q.Justificativa || q.justificativa || "Gabarito comentado indisponível.";
        }

        function sairDoResultadoParaHistorico() {
            abrirTelaHistorico();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function refazerMesmoSimulado() {
            listaQuestoes.sort(() => Math.random() - 0.5);
            respostasUsuario = [];
            document.querySelectorAll('.view-simulado').forEach(v => v.classList.remove('active'));
            document.getElementById('sim-view-prova').classList.add('active');
            mostrarQuestaoProva(0);
            iniciarCronometroProva();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function renderizarColunaHistorico() {
            const container = document.getElementById('container-cards-historico');
            if (!container) return;

            if (historicoProvas.length === 0) {
                container.innerHTML = `<p style="grid-column: 1/-1; color:#666;">Nenhum simulado realizado ainda na sua conta.</p>`;
                return;
            }

            container.innerHTML = historicoProvas.map((item, idx) => `
                <div class="card-item-historico" title="Clique para abrir o Gabarito desta prova" onclick="reabrirGabaritoDoHistorico(${idx})">
                    <div class="hist-data">${item.data}</div>
                    <h4>${item.titulo}</h4>
                    <div class="hist-linha-dados">
                        <div class="hist-info-esq">${item.qtdQuestoes} Questões<br>${item.tempoMinutos} Minutos</div>
                        <div class="hist-nota-dir">${item.notaFormatada}</div>
                    </div>
                    <button class="btn-hist-refazer" onclick="event.stopPropagation(); refazerAPartirDoHistorico(${idx});">Refazer</button>
                </div>
            `).join('');
        }

        function reabrirGabaritoDoHistorico(idx) {
            const item = historicoProvas[idx];
            if (!item || !item.respostasSalvas) return;
            respostasUsuario = item.respostasSalvas;
            listaQuestoes = item.questoesSalvas;
            const acertos = respostasUsuario.filter(r => r && r.acertou).length;
            abrirRevisaoModal(respostasUsuario, acertos, listaQuestoes.length);
        }

        function refazerAPartirDoHistorico(idx) {
            const item = historicoProvas[idx];
            if (!item || !item.questoesSalvas) {
                fluxoClicarSimuladoParaConfigurar();
                return;
            }
            listaQuestoes = [...item.questoesSalvas];
            refazerMesmoSimulado();
        }



        // Inicialização Unificada
        window.addEventListener('DOMContentLoaded', () => {
            carregarApostilasDoFirebase();
            carregarSimuladosDoFirebase();
        });
