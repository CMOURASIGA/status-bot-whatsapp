# Pasta onde os pacotes serão salvos
$ApkDir = Join-Path $PSScriptRoot "apk-packages"

# Cria a pasta se não existir
if (-not (Test-Path -Path $ApkDir)) {
    New-Item -ItemType Directory -Path $ApkDir | Out-Null
}

# Limpa arquivos antigos
Write-Host "Limpando arquivos antigos..."
Get-ChildItem -Path $ApkDir -Filter *.apk | Remove-Item

# Lista de pacotes necessários na v3.22
$Packages = @(
    "https://dl-cdn.alpinelinux.org/alpine/v3.22/main/x86_64/openssl-3.5.0-r0.apk ",
    "https://dl-cdn.alpinelinux.org/alpine/v3.22/main/x86_64/busybox-extras-1.37.0-r16.apk ",
    "https://dl-cdn.alpinelinux.org/alpine/v3.22/main/x86_64/curl-8.13.0-r1.apk ",
    "https://dl-cdn.alpinelinux.org/alpine/v3.22/main/x86_64/ca-certificates-20241121-r2.apk "
)

# Baixa cada pacote
foreach ($pkg in $Packages) {
    $filename = [System.IO.Path]::GetFileName($pkg)
    $output = Join-Path $ApkDir $filename
    Write-Host "Baixando $filename..."
    try {
        Invoke-WebRequest -Uri $pkg -OutFile $output -UseBasicParsing
        Write-Host "$filename baixado com sucesso."
    } catch {
        $errorMsg = $_.Exception.Message
        Write-Host ("Erro ao baixar " + $filename + ": " + $errorMsg) -ForegroundColor Red
    }
}

Write-Host "Download concluído!" -ForegroundColor Green