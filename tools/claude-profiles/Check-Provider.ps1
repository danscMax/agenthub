<#
.SYNOPSIS
    Liveness check for an OpenAI/Anthropic-compatible provider: GET {BaseUrl}/models with the
    provider's API key (read from STDIN, never argv). Prints a one-line JSON result.

.DESCRIPTION
    STDIN: the API key (plain, optional — local engines may need none).
    Output (stdout): { "ok": true|false, "detail": "...", "count": <n> }  (single line)
#>
param(
    [Parameter(Mandatory)][string]$BaseUrl
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$key = ([Console]::In.ReadToEnd()).Trim()
$uri = "$($BaseUrl.TrimEnd('/'))/models"
$headers = @{}
if ($key) { $headers['Authorization'] = "Bearer $key" }

try {
    $r = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers -TimeoutSec 12
    $n = 0
    if ($r.data) { $n = @($r.data).Count } elseif ($r -is [System.Array]) { $n = $r.Count }
    @{ ok = $true; detail = "ответил (моделей: $n)"; count = $n } | ConvertTo-Json -Compress
} catch {
    $st = $null; try { $st = [int]$_.Exception.Response.StatusCode } catch {}
    $detail =
    if ($st -eq 401 -or $st -eq 403) { "ключ отклонён ($st)" }
    elseif ($st) { "ответ HTTP $st" }
    else { "не отвечает: $($_.Exception.Message)" }
    @{ ok = $false; detail = $detail } | ConvertTo-Json -Compress
}
