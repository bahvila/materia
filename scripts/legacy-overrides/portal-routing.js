// Navegação persistente entre as páginas principais
        const rotasPorSeparador = {
            inicio: '/',
            apostila: '/apostila',
            simulados: '/simulados',
            biblioteca: '/biblioteca'
        };
        const titulosPorSeparador = {
            inicio: 'Matéria',
            apostila: 'Apostila | Matéria',
            simulados: 'Simulados | Matéria',
            biblioteca: 'Biblioteca | Matéria'
        };
        const mudarSeparadorOriginal = window.mudarSeparador;

        function separadorDaUrl() {
            const caminho = window.location.pathname.replace(/\/+$/, '') || '/';
            const rotasAceitas = {
                '/': 'inicio',
                '/inicio': 'inicio',
                '/apostila': 'apostila',
                '/apostilas': 'apostila',
                '/simulado': 'simulados',
                '/simulados': 'simulados',
                '/biblioteca': 'biblioteca'
            };
            return rotasAceitas[caminho] || 'inicio';
        }

        window.mudarSeparador = function(id, atualizarEndereco = true) {
            if (!rotasPorSeparador[id]) id = 'inicio';
            mudarSeparadorOriginal(id);
            document.title = titulosPorSeparador[id];

            if (atualizarEndereco) {
                const destino = rotasPorSeparador[id];
                if (window.location.pathname !== destino) {
                    window.history.pushState({ separador: id }, '', destino);
                }
            }
        };

        window.addEventListener('popstate', () => {
            window.mudarSeparador(separadorDaUrl(), false);
        });

        window.mudarSeparador(separadorDaUrl(), false);
