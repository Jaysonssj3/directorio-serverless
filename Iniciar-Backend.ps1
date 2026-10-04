param(
    [string]$DbUser = 'postgres',
    [string]$DbHost = 'localhost',
    [int]$DbPort = 5432,
    [string]$DbName = 'usuarios',
    [int]$Port = 8080,
    [switch]$CrearAdministrador
)
$ErrorActionPreference = 'Stop'
# Ejecutar desde Windows PowerShell. La API aplica migraciones al arrancar. No instala programas.
try {
    if (-not (Get-Command java -ErrorAction SilentlyContinue)) { throw 'No se encuentra Java. Instala JDK 21 o superior compatible y vuelve a abrir PowerShell.' }
    $jarCandidates = @(
        (Join-Path $PSScriptRoot 'usuarios-api-2.0.0.jar'),
        (Join-Path $PSScriptRoot '..\usuarios-api-2.0.0.jar'),
        (Join-Path $PSScriptRoot 'backend\target\usuarios-api-2.0.0.jar')
    )
    $jar = $jarCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $jar) { throw 'No se encuentra el JAR actualizado. Copia usuarios-api-2.0.0.jar junto a este script, o compila dentro de backend con .\mvnw.cmd verify.' }
    if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { throw "El puerto $Port ya esta ocupado. Deten la API anterior con Ctrl+C o usa -Port 8082." }
    Write-Host ''
    Write-Host 'DIRECTORIO - Inicio local' -ForegroundColor Cyan
    Write-Host "Base: $DbHost`:$DbPort/$DbName | Usuario de PostgreSQL: $DbUser"
    $dbSecret = Read-Host 'Contrasena de PostgreSQL (no la de la cuenta web)' -AsSecureString
    $env:DB_URL = "jdbc:postgresql://${DbHost}:${DbPort}/${DbName}"
    $env:DB_USERNAME = $DbUser
    $env:DB_PASSWORD = ([pscredential]::new($DbUser, $dbSecret)).GetNetworkCredential().Password
    $env:PORT = [string]$Port
    # DPAPI cifra el secreto para este usuario de Windows, sin guardarlo en texto plano.
    $localDir = Join-Path $PSScriptRoot '.local'
    $keyPath = Join-Path $localDir 'jwt-secret.dpapi'
    if (-not (Test-Path -LiteralPath $keyPath)) {
        New-Item -ItemType Directory -Path $localDir -Force | Out-Null
        $randomBytes = New-Object byte[] 32
        $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try { $random.GetBytes($randomBytes) } finally { $random.Dispose() }
        $secureKey = ConvertTo-SecureString -String ([Convert]::ToBase64String($randomBytes)) -AsPlainText -Force
        $secureKey | ConvertFrom-SecureString | Set-Content -LiteralPath $keyPath -Encoding ASCII
    }
    # Set-Content agrega un salto de linea. DPAPI espera solo la cadena hexadecimal.
    $encryptedKey = (Get-Content -LiteralPath $keyPath -Raw).Trim()
    $storedKey = ConvertTo-SecureString -String $encryptedKey
    $env:JWT_SECRET = ([pscredential]::new('jwt', $storedKey)).GetNetworkCredential().Password
    $env:BOOTSTRAP_ADMIN_ENABLED = 'false'
    Remove-Item Env:BOOTSTRAP_ADMIN_EMAIL,Env:BOOTSTRAP_ADMIN_PASSWORD -ErrorAction SilentlyContinue
    if ($CrearAdministrador) {
        $adminEmail = Read-Host 'Correo del primer administrador'
        $adminSecure = Read-Host 'Contrasena nueva del administrador (minimo 12 caracteres)' -AsSecureString
        $adminPlain = ([pscredential]::new($adminEmail, $adminSecure)).GetNetworkCredential().Password
        if ($adminPlain.Length -lt 12 -or [Text.Encoding]::UTF8.GetByteCount($adminPlain) -gt 72) { throw 'La contrasena del administrador debe tener 12 caracteres como minimo y 72 bytes como maximo.' }
        $env:BOOTSTRAP_ADMIN_ENABLED = 'true'
        $env:BOOTSTRAP_ADMIN_EMAIL = $adminEmail
        $env:BOOTSTRAP_ADMIN_PASSWORD = $adminPlain
        $adminPlain = $null
    }
    Write-Host ''
    Write-Host "Cuando aparezca Started UsuariosApplication, conecta la app movil a la IP de esta PC, puerto $Port" -ForegroundColor Green
    Write-Host 'Para el telefono: consulta tu direccion IPv4 Wi-Fi con ipconfig.'
    Write-Host 'Manten esta ventana abierta. Para detener la aplicacion: Ctrl+C.'
    Write-Host ''
    & java -jar $jar
    if ($LASTEXITCODE -ne 0) { throw 'La aplicacion no pudo iniciarse. Revisa el mensaje de error anterior.' }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
} finally {
    Remove-Item Env:DB_PASSWORD,Env:JWT_SECRET,Env:BOOTSTRAP_ADMIN_PASSWORD -ErrorAction SilentlyContinue
}


