param(
  [string]$Region = "ap-northeast-1",
  [string]$UserPoolId = "ap-northeast-1_pwYcPWOyR",
  [string]$ClientId = "2b9fkkb4u5di8veelnmjkmnldj",
  [string]$GoogleClientId = $env:GOOGLE_OAUTH_CLIENT_ID,
  [string]$GoogleClientSecret = $env:GOOGLE_OAUTH_CLIENT_SECRET,
  [string]$AppleServicesId = $env:APPLE_SERVICES_ID,
  [string]$AppleTeamId = $env:APPLE_TEAM_ID,
  [string]$AppleKeyId = $env:APPLE_KEY_ID,
  [string]$ApplePrivateKey = $env:APPLE_PRIVATE_KEY
)

$ErrorActionPreference = "Stop"

function Test-ProviderExists {
  param([string]$ProviderName)

  aws cognito-idp describe-identity-provider `
    --region $Region `
    --user-pool-id $UserPoolId `
    --provider-name $ProviderName *> $null

  return $LASTEXITCODE -eq 0
}

function Upsert-Provider {
  param(
    [string]$ProviderName,
    [string]$ProviderType,
    [hashtable]$ProviderDetails,
    [hashtable]$AttributeMapping
  )

  $detailsJson = $ProviderDetails | ConvertTo-Json -Compress
  $mappingJson = $AttributeMapping | ConvertTo-Json -Compress

  if (Test-ProviderExists -ProviderName $ProviderName) {
    aws cognito-idp update-identity-provider `
      --region $Region `
      --user-pool-id $UserPoolId `
      --provider-name $ProviderName `
      --provider-details $detailsJson `
      --attribute-mapping $mappingJson | Out-Null
    return
  }

  aws cognito-idp create-identity-provider `
    --region $Region `
    --user-pool-id $UserPoolId `
    --provider-name $ProviderName `
    --provider-type $ProviderType `
    --provider-details $detailsJson `
    --attribute-mapping $mappingJson | Out-Null
}

$client = aws cognito-idp describe-user-pool-client `
  --region $Region `
  --user-pool-id $UserPoolId `
  --client-id $ClientId `
  --query "UserPoolClient" `
  --output json | ConvertFrom-Json

$enabledProviders = @($client.SupportedIdentityProviders)
if ($enabledProviders.Count -eq 0) {
  $enabledProviders = @("COGNITO")
}

function Add-EnabledProvider {
  param([string]$ProviderName)

  if ($enabledProviders -notcontains $ProviderName) {
    $script:enabledProviders += $ProviderName
  }
}

if ($GoogleClientId -and $GoogleClientSecret) {
  Upsert-Provider `
    -ProviderName "Google" `
    -ProviderType "Google" `
    -ProviderDetails @{
      client_id = $GoogleClientId
      client_secret = $GoogleClientSecret
      authorize_scopes = "openid email profile"
    } `
    -AttributeMapping @{
      email = "email"
      name = "name"
      given_name = "given_name"
      family_name = "family_name"
      picture = "picture"
    }
  Add-EnabledProvider -ProviderName "Google"
}

if ($AppleServicesId -and $AppleTeamId -and $AppleKeyId -and $ApplePrivateKey) {
  Upsert-Provider `
    -ProviderName "SignInWithApple" `
    -ProviderType "SignInWithApple" `
    -ProviderDetails @{
      client_id = $AppleServicesId
      team_id = $AppleTeamId
      key_id = $AppleKeyId
      private_key = $ApplePrivateKey
      authorize_scopes = "email name"
    } `
    -AttributeMapping @{
      email = "email"
      name = "name"
    }
  Add-EnabledProvider -ProviderName "SignInWithApple"
}

if (-not ($GoogleClientId -and $GoogleClientSecret) -and -not ($AppleServicesId -and $AppleTeamId -and $AppleKeyId -and $ApplePrivateKey)) {
  throw "No social provider credentials were supplied. Set GOOGLE_OAUTH_CLIENT_ID/SECRET or APPLE_* environment variables."
}

$callbackUrls = @($client.CallbackURLs)
if ($callbackUrls.Count -eq 0) {
  $callbackUrls = @(
    "http://localhost:3000/auth/callback",
    "https://app.tastile.app/auth/callback",
    "tastile://auth/callback"
  )
}

$logoutUrls = @($client.LogoutURLs)
if ($logoutUrls.Count -eq 0) {
  $logoutUrls = @(
    "http://localhost:3000",
    "https://app.tastile.app",
    "tastile://auth/logout"
  )
}

$oauthFlows = @($client.AllowedOAuthFlows)
if ($oauthFlows.Count -eq 0) {
  $oauthFlows = @("code")
}

$oauthScopes = @($client.AllowedOAuthScopes)
if ($oauthScopes.Count -eq 0) {
  $oauthScopes = @("openid", "email", "profile")
}

aws cognito-idp update-user-pool-client `
  --region $Region `
  --user-pool-id $UserPoolId `
  --client-id $ClientId `
  --supported-identity-providers $enabledProviders `
  --callback-urls $callbackUrls `
  --logout-urls $logoutUrls `
  --allowed-o-auth-flows $oauthFlows `
  --allowed-o-auth-scopes $oauthScopes `
  --allowed-o-auth-flows-user-pool-client | Out-Null

Write-Host "Configured Cognito identity providers: $($enabledProviders -join ',')"
Write-Host "Set NEXT_PUBLIC_COGNITO_ENABLED_PROVIDERS=$($enabledProviders -join ',') in the web runtime after verifying Hosted UI sign-in."
