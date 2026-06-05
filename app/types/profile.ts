export interface Profile {
  slug: string
  displayName: string
  givenName: string | null
  engine: string
  isDefault: boolean
  active: boolean
  hermesDir: string
  backgroundColor: string
  gesture: string
  avatarSeed: string
  avatarUrl: string
  avatarPortraitUrl: string
  firstSeen: string
  lastSeen: string
  description: string | null
  model: string | null
}

export interface ProfileConfig {
  slug: string
  givenName: string | null
  active: boolean
  engine: string
  model: string | null
  apiKey: string | null
  apiUrl: string | null
}
