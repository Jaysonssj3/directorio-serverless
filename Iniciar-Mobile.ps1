param([int]$ApiPort = 8080)
$ErrorActionPreference = 'Stop'
$previousHostname = $env:REACT_NATIVE_PACKAGER_HOSTNAME
try {
    $node = Join-Path $env:ProgramFiles 'nodejs\node.exe'
    if (-not (Test-Path -LiteralPath $node)) {
        $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
        if (-not $nodeCommand) { throw 'Instala Node.js 24 LTS antes de la clase.' }
        $node = $nodeCommand.Source
    }
    $mobile = Join-Path $PSScriptRoot 'mobile'
    $cli = Join-Path $mobile 'node_modules\expo\bin\cli'
    if (-not (Test-Path -LiteralPath $cli)) { throw 'Faltan dependencias. Abre PowerShell en mobile y ejecuta npm.cmd ci con internet antes de presentar.' }
    $addresses = @(
        foreach ($adapter in [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
            if ($adapter.OperationalStatus -ne 'Up') { continue }
            $properties = $adapter.GetIPProperties()
            if (-not ($properties.GatewayAddresses | Where-Object { $_.Address.AddressFamily -eq 'InterNetwork' -and $_.Address.IPAddressToString -ne '0.0.0.0' })) { continue }
            foreach ($entry in $properties.UnicastAddresses) {
                if ($entry.Address.AddressFamily -eq 'InterNetwork' -and -not $entry.Address.IPAddressToString.StartsWith('169.254.')) {
                    [pscustomobject]@{ Adapter=$adapter.Name; IP=$entry.Address.IPAddressToString }
                }
            }
        }
    )
    if ($addresses.Count -eq 0) { throw 'Conecta la PC al punto de acceso del iPhone y vuelve a iniciar.' }
    $choice = 0
    if ($addresses.Count -gt 1) {
        Write-Host 'Elige la conexion que esta usando el internet del iPhone:'
        for ($i=0; $i -lt $addresses.Count; $i++) { Write-Host "$($i+1). $($addresses[$i].Adapter): $($addresses[$i].IP)" }
        $inputChoice = Read-Host 'Numero de conexion'
        $parsed = 0
        if (-not [int]::TryParse($inputChoice, [ref]$parsed) -or $parsed -lt 1 -or $parsed -gt $addresses.Count) { throw 'Seleccion no valida. Abre el iniciador otra vez.' }
        $choice = $parsed - 1
    }
    $ip = $addresses[$choice].IP
    $env:REACT_NATIVE_PACKAGER_HOSTNAME = $ip
    Write-Host ''
    Write-Host "EN LA APP, DIRECCION DEL BACKEND: http://${ip}:$ApiPort" -ForegroundColor Green
    Write-Host "PRUEBA EN SAFARI: http://${ip}:$ApiPort/api/usuarios"
    Write-Host 'Una respuesta 401 en Safari es normal: confirma que llegas a la API.'
    Write-Host 'Escanea el nuevo QR. Deja esta ventana y la del backend abiertas.'
    Push-Location $mobile
    try { & $node $cli start --lan --go } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw 'Expo termino con un error. Revisa el mensaje anterior.' }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
} finally {
    $env:REACT_NATIVE_PACKAGER_HOSTNAME = $previousHostname
}
