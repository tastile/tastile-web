import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tryGetCognitoEnv } from './env'

const VARS = [
  'NEXT_PUBLIC_COGNITO_USER_POOL_ID',
  'NEXT_PUBLIC_COGNITO_CLIENT_ID',
  'NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN',
  'NEXT_PUBLIC_COGNITO_ISSUER',
  'NEXT_PUBLIC_COGNITO_JWKS_URL',
  'NEXT_PUBLIC_COGNITO_REGION',
  'NEXT_PUBLIC_COGNITO_CALLBACK_URL',
  'NEXT_PUBLIC_COGNITO_LOGOUT_URL',
]

describe('tryGetCognitoEnv', () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const v of VARS) {
      saved[v] = process.env[v]
      delete process.env[v]
    }
  })

  afterEach(() => {
    for (const v of VARS) {
      if (saved[v] === undefined) {
        delete process.env[v]
      } else {
        process.env[v] = saved[v]
      }
    }
  })

  it('returns null when any var is missing', () => {
    expect(tryGetCognitoEnv()).toBeNull()
  })

  it('returns null when only one var is set', () => {
    process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = 'ap-northeast-1_pwYcPWOyR'
    expect(tryGetCognitoEnv()).toBeNull()
  })

  it('trims whitespace from values', () => {
    process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = '  ap-northeast-1_pwYcPWOyR  \n'
    process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = 'client\n'
    process.env.NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN = 'tastile-beta'
    process.env.NEXT_PUBLIC_COGNITO_ISSUER = 'https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_pwYcPWOyR'
    process.env.NEXT_PUBLIC_COGNITO_JWKS_URL = 'https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_pwYcPWOyR/.well-known/jwks.json'
    process.env.NEXT_PUBLIC_COGNITO_REGION = 'ap-northeast-1'
    process.env.NEXT_PUBLIC_COGNITO_CALLBACK_URL = 'http://localhost:3000/auth/callback'
    process.env.NEXT_PUBLIC_COGNITO_LOGOUT_URL = 'http://localhost:3000'

    const env = tryGetCognitoEnv()
    expect(env).not.toBeNull()
    expect(env?.userPoolId).toBe('ap-northeast-1_pwYcPWOyR')
    expect(env?.clientId).toBe('client')
  })

  it('returns a full env when all vars are set', () => {
    process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = 'ap-northeast-1_pwYcPWOyR'
    process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = '2b9fkkb4u5di8veelnmjkmnldj'
    process.env.NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN = 'tastile-beta'
    process.env.NEXT_PUBLIC_COGNITO_ISSUER =
      'https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_pwYcPWOyR'
    process.env.NEXT_PUBLIC_COGNITO_JWKS_URL =
      'https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_pwYcPWOyR/.well-known/jwks.json'
    process.env.NEXT_PUBLIC_COGNITO_REGION = 'ap-northeast-1'
    process.env.NEXT_PUBLIC_COGNITO_CALLBACK_URL = 'http://localhost:3000/auth/callback'
    process.env.NEXT_PUBLIC_COGNITO_LOGOUT_URL = 'http://localhost:3000'

    const env = tryGetCognitoEnv()
    expect(env).not.toBeNull()
    expect(env?.hostedUiBaseUrl).toBe('https://tastile-beta.auth.ap-northeast-1.amazoncognito.com')
    expect(env?.userPoolId).toBe('ap-northeast-1_pwYcPWOyR')
    expect(env?.clientId).toBe('2b9fkkb4u5di8veelnmjkmnldj')
  })
})
