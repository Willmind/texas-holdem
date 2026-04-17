export function buildPots(contrib: readonly number[], aliveMask: readonly boolean[]): { amount: number; eligible: number[] }[] {
  if (contrib.length !== aliveMask.length) throw new Error('buildPots: length mismatch')
  const n = contrib.length
  const levels = [...new Set(contrib.filter((c) => c > 0))].sort((a, b) => a - b)

  const pots: { amount: number; eligible: number[] }[] = []
  let prev = 0
  for (const level of levels) {
    const inThisLevel: number[] = []
    let contributors = 0
    for (let i = 0; i < n; i += 1) {
      if (contrib[i] >= level) contributors += 1
      if (aliveMask[i] && contrib[i] >= level) inThisLevel.push(i)
    }
    const tranche = (level - prev) * contributors
    if (tranche > 0) pots.push({ amount: tranche, eligible: inThisLevel })
    prev = level
  }
  return pots
}

