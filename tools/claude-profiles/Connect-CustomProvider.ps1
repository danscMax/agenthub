<#
.SYNOPSIS
    Register a custom OpenAI-compatible provider in the freellmapi gateway via its admin API.

.DESCRIPTION
    POSTs to {Gateway}/api/keys/custom (the "Add a custom OpenAI-compatible model" surface of the
    freellmapi dashboard). Both secrets — the freellmapi dashboard-session token and the provider's
    own API key — are read from STDIN, never argv (argv is world-readable on Windows via WMI /
    Get-CimInstance Win32_Process). No Read-Host (dashboard-safe).

    STDIN payload: first line = dashboard token, the remainder = provider API key.

.EXAMPLE
    'dashtoken','sk-deepseek...' -join "`n" | .\Connect-CustomProvider.ps1 `
        -Gateway http://localhost:13001 -BaseUrl https://api.deepseek.com/v1 -Model deepseek-chat -DisplayName DeepSeek
#>
param(
    [Parameter(Mandatory)][string]$Gateway,
    [Parameter(Mandatory)][string]$BaseUrl,
    [string]$Model,
    [string]$DisplayName,
    [string]$Label
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Secrets via STDIN: line 1 = freellmapi dashboard token, the rest = provider API key.
$payload = [Console]::In.ReadToEnd()
$nl = $payload.IndexOf("`n")
if ($nl -lt 0) {
    Write-Host 'ОШИБКА: ожидался STDIN (токен дашборда + ключ провайдера).' -ForegroundColor Red
    exit 1
}
$dashToken = $payload.Substring(0, $nl).Trim()
$apiKey = $payload.Substring($nl + 1).Trim()
if (-not $dashToken) { Write-Host 'ОШИБКА: пустой dashboard-токен freellmapi.' -ForegroundColor Red; exit 1 }

$uri = "$($Gateway.TrimEnd('/'))/api/keys/custom"
$body = @{
    baseUrl     = $BaseUrl
    displayName = if ($DisplayName) { $DisplayName } else { $BaseUrl }
}
if ($Label) { $body['label'] = $Label }
if ($Model) { $body['models'] = @($Model) }
if ($apiKey) { $body['apiKey'] = $apiKey }

Write-Host '=== freellmapi: регистрация custom-провайдера ===' -ForegroundColor Cyan
Write-Host "  POST $uri  (baseUrl=$BaseUrl, model=$(if ($Model) { $Model } else { '—' }))" -ForegroundColor Gray

try {
    $resp = Invoke-RestMethod -Method Post -Uri $uri `
        -Headers @{ Authorization = "Bearer $dashToken" } `
        -Body ($body | ConvertTo-Json -Depth 6) -ContentType 'application/json'
    Write-Host "  OK: провайдер зарегистрирован (keyId=$($resp.keyId), platform=$($resp.platform))." -ForegroundColor Green
    if ($resp.models) { Write-Host "  Модели: $($resp.models -join ', ')" -ForegroundColor Gray }
    Write-Host '  Готово. Провайдер доступен через freellmapi (:13001) для Claude Code (ccr) и opencode.' -ForegroundColor Green
    exit 0
} catch {
    $msg = $_.Exception.Message
    $status = $null
    try { $status = [int]$_.Exception.Response.StatusCode } catch {}
    if ($status -eq 401 -or $status -eq 403) {
        Write-Host "  ОШИБКА авторизации ($status): неверный или просроченный dashboard-токен freellmapi." -ForegroundColor Red
    } elseif ($status -eq 400) {
        Write-Host "  ОШИБКА (400): freellmapi отклонил baseUrl или тело запроса. $msg" -ForegroundColor Red
    } else {
        Write-Host "  ОШИБКА запроса к freellmapi: $msg" -ForegroundColor Red
    }
    exit 1
}
