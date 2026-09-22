/** Keep punctuation: C, C++, C#, Java and JavaScript are distinct skills. */
export function normalizeSkill(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ')
}

// Deliberately small. These aliases are used only after an exact match fails.
export const SKILL_ALIASES: Readonly<Record<string, readonly string[]>> = {
  javascript: ['js'],
  typescript: ['ts'],
  'node.js': ['node', 'nodejs'],
  postgresql: ['postgres'],
}
const canonical = new Map(Object.entries(SKILL_ALIASES).flatMap(([key, aliases]) =>
  [key, ...aliases].map((alias) => [alias, key] as const)))
export function canonicalSkill(value: string): string {
  const normalized = normalizeSkill(value)
  return canonical.get(normalized) ?? normalized
}

export function uniqueSkills(skills: string[]): string[] {
  return [...new Map(skills.filter((skill) => skill.trim()).map((skill) => [canonicalSkill(skill), skill.trim()])).values()]
}

export interface SkillIndex<T> {
  exact: Map<string, T[]>
  aliases: Map<string, T[]>
}
export function indexSkills<T>(options: T[], label: (option: T) => string): SkillIndex<T> {
  const index: SkillIndex<T> = { exact: new Map(), aliases: new Map() }
  for (const option of options) {
    const text = label(option)
    for (const [map, key] of [[index.exact, normalizeSkill(text)], [index.aliases, canonicalSkill(text)]] as const) {
      if (key) map.set(key, [...(map.get(key) ?? []), option])
    }
  }
  return index
}
export function matchSkill<T>(index: SkillIndex<T>, desired: string): T[] {
  return index.exact.get(normalizeSkill(desired)) ?? index.aliases.get(canonicalSkill(desired)) ?? []
}
