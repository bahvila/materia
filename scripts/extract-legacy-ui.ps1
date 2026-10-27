$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $root 'legado\html-original-2026-10-27'
$targetRoot = Join-Path $root 'public\legacy'
$utf8 = New-Object System.Text.UTF8Encoding($false)

[System.IO.Directory]::CreateDirectory($targetRoot) | Out-Null

function Export-LegacyPage {
    param(
        [Parameter(Mandatory)] [string] $Source,
        [Parameter(Mandatory)] [string] $Name
    )

    $document = [System.IO.File]::ReadAllText($Source)
    $style = [regex]::Match($document, '(?s)<style>\s*(.*?)\s*</style>')
    $body = [regex]::Match($document, '(?s)<body>\s*(.*?)\s*<script>\s*(.*?)\s*</script>\s*</body>')

    if (-not $style.Success -or -not $body.Success) {
        throw "Não foi possível extrair a estrutura de $Source"
    }

    [System.IO.File]::WriteAllText((Join-Path $targetRoot "$Name.css"), $style.Groups[1].Value, $utf8)
    [System.IO.File]::WriteAllText((Join-Path $targetRoot "$Name.html"), $body.Groups[1].Value, $utf8)
    [System.IO.File]::WriteAllText((Join-Path $targetRoot "$Name.js"), $body.Groups[2].Value, $utf8)
}

Export-LegacyPage -Source (Join-Path $sourceRoot 'index.html') -Name 'portal'
Export-LegacyPage -Source (Join-Path $sourceRoot 'paineldecontrole.html') -Name 'admin'

# Mantém uma única cópia de cada imagem ativa em public/assets, mesmo quando o
# HTML histórico usa vários nomes para o mesmo arquivo.
$portalHtmlPath = Join-Path $targetRoot 'portal.html'
$portalHtml = [System.IO.File]::ReadAllText($portalHtmlPath)
$assetReplacements = @{
    'logomateria1.png' = '/assets/íconemateriamarrom.png'
    'logomateria2.png' = '/assets/logo-materia.png'
    'íconemateriabranco.png' = '/assets/logo-materia.png'
    'íconemateriapremium.png' = '/assets/premium.png'
    'íconemateriapremium_2.png' = '/assets/premium.png'
    'você é premium.png' = '/assets/premium.png'
    'íconecupom.png' = '/assets/icone-cupom.png'
}
foreach ($entry in $assetReplacements.GetEnumerator()) {
    $portalHtml = $portalHtml.Replace($entry.Key, $entry.Value)
}
$premiumLogoPattern = '<img src="/assets/premium\.png"[^>]*style="max-width: 280px; width: 100%;"[^>]*>'
$premiumLogoMarkup = '<img class="premium-marca-imagem" src="/assets/íconemateriapremium.png" alt="Matéria Premium">'
$portalHtml = [regex]::Replace($portalHtml, $premiumLogoPattern, $premiumLogoMarkup.Trim())
[System.IO.File]::WriteAllText($portalHtmlPath, $portalHtml, $utf8)

$portalCssPath = Join-Path $targetRoot 'portal.css'
$premiumCssPath = Join-Path $PSScriptRoot 'legacy-overrides\portal-premium.css'
$portalCss = [System.IO.File]::ReadAllText($portalCssPath)
$premiumCss = [System.IO.File]::ReadAllText($premiumCssPath)
[System.IO.File]::WriteAllText($portalCssPath, "$portalCss`r`n`r`n/* Ajustes atuais do modal premium */`r`n$premiumCss", $utf8)

# O servidor atual do PDF não libera CORS para localhost. Esta adaptação usa
# o proxy do Vite apenas no desenvolvimento e mantém a URL original em produção.
$portalScriptPath = Join-Path $targetRoot 'portal.js'
$portalScript = [System.IO.File]::ReadAllText($portalScriptPath)
$originalPdfLine = "            const arquivoPDF = apostilaSelecionada.pdfUrl || 'apostilaadministração.pdf';"
$adaptedPdfBlock = @'
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
'@
$portalScript = $portalScript.Replace($originalPdfLine, $adaptedPdfBlock.TrimEnd())
$routingScriptPath = Join-Path $PSScriptRoot 'legacy-overrides\\portal-routing.js'
$routingScript = [System.IO.File]::ReadAllText($routingScriptPath)
$portalScript = "$portalScript`r`n`r`n$routingScript"
[System.IO.File]::WriteAllText($portalScriptPath, $portalScript, $utf8)
