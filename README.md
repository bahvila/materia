# Matéria Education

Aplicação Matéria migrada para React e Vite, preservando fielmente a interface e os comportamentos da versão HTML original.

## Executar

```powershell
npm install
npm run dev
```

Para gerar a versão de produção:

```powershell
npm run build
```

## Estrutura

- `src/legacy/LegacyPage.jsx`: montagem React das interfaces preservadas.
- `public/legacy`: HTML, CSS e JavaScript extraídos sem alteração da versão original.
- `public/assets`: imagens fornecidas para a marca.
- `legado/html-original-2026-10-27`: versão HTML anterior, preservada integralmente.

## Rotas

- `/` — início
- `/admin` — painel administrativo

O arquivo `paineldecontrole.html` foi mantido para redirecionar links antigos para `/admin`.
