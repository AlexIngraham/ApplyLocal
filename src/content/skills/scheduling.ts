// One selection per browser yield allows framework state and DOM replacements to settle.
export const SKILL_FILL_YIELD_MS = 16
export const SKILL_CONDITION_TIMEOUT_MS = 900
export const yieldSkillsDom = () => new Promise<void>((resolve) => setTimeout(resolve, SKILL_FILL_YIELD_MS))

export async function waitForSkillsCondition(predicate: () => boolean): Promise<boolean> {
  const deadline = Date.now() + SKILL_CONDITION_TIMEOUT_MS
  do {
    if (predicate()) return true
    await yieldSkillsDom()
  } while (Date.now() < deadline)
  return predicate()
}
