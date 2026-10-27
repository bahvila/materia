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
[System.IO.File]::WriteAllText($portalScriptPath, $portalScript, $utf8)
