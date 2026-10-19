// Everything in the build ships to every visitor. This finds anything in it that
// looks like a secret, so the build can fail before it is ever deployed.

const PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'Supabase secret key', pattern: /sb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: 'Linear API key', pattern: /lin_api_[A-Za-z0-9]{10,}/ },
  { name: 'Google client secret', pattern: /GOCSPX-[A-Za-z0-9_-]{10,}/ },
  { name: 'private key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
]

const JWT = /eyJ[A-Za-z0-9_-]+\.(eyJ[A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g

function jwtRole(payload: string): string | undefined {
  try {
    const json = Buffer.from(payload, 'base64url').toString('utf8')
    return (JSON.parse(json) as { role?: string }).role
  } catch {
    return undefined
  }
}

/** Returns a short description of each secret found. It never repeats the secret itself. */
export function findSecrets(text: string): string[] {
  const found = PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ name }) => name)
  for (const [, payload] of text.matchAll(JWT)) {
    // A legacy anon key is public by design. Any other role can bypass row-level security.
    if (jwtRole(payload) !== 'anon') found.push('Supabase key with elevated access')
  }
  return [...new Set(found)]
}
