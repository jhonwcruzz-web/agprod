/*
 * Simulador de producao de uva: da meta comercial ate' a poda.
 *
 * A conta e' feita de tras para frente, como o consultor faz no campo:
 *
 *   meta comercial (t/ha)
 *     / (1 - perdas)                        -> producao bruta no pe'
 *     / plantas por ha                      -> kg por planta
 *     / peso do cacho                       -> cachos por planta
 *     / cachos por broto fertil             -> brotos ferteis por planta
 *     / (brotacao x fertilidade x viaveis)  -> gemas por planta
 *     / saidas (bracos) por planta          -> gemas por saida
 *     = varas por saida x gemas por vara    -> opcoes de poda
 *
 * Como varas e gemas sao numeros inteiros, cada opcao de poda e' conferida
 * no sentido inverso (da poda ate' as toneladas) para mostrar a producao
 * que ela realmente entrega.
 *
 * Fertilidade em dois trechos da vara: as gemas da base (1 a 5) costumam
 * ser bem menos ferteis que as do meio/ponta (6 em diante) — nas analises
 * de campo, 17% contra 48%. Cada comprimento de vara usa a media ponderada
 * dos dois trechos; sem o segundo numero, a vara toda vale como a base.
 */

export type SimInput = {
  targetTHa: number // meta comercial, t/ha
  lossPct: number // perdas na colheita e no packing, %
  rowSpacingM: number // entre linhas, m
  plantSpacingM: number // entre plantas, m
  armsPerPlant: number // saidas (bracos/cordoes) por planta
  berryWeightG: number // peso medio da baga, g
  bunchWeightG: number // peso do cacho comercial, g
  budFertilityPct: number // % das gemas 1 a 5 (base da vara) que trazem cacho
  tipFertilityPct: number // % das gemas 6 em diante; NaN = igual a' base
  budBreakPct: number // % das gemas que brotam
  bunchesPerShoot: number // cachos deixados por broto fertil (apos raleio)
  deadBudsPct: number // gemas mortas/danificadas (acaro), % — saem da conta
}

export const SIM_DEFAULTS: SimInput = {
  targetTHa: 25,
  lossPct: 10,
  rowSpacingM: 3.5,
  plantSpacingM: 2,
  armsPerPlant: 4,
  berryWeightG: 8,
  bunchWeightG: 500,
  budFertilityPct: 40,
  tipFertilityPct: NaN,
  budBreakPct: 85,
  bunchesPerShoot: 1,
  deadBudsPct: 0,
}

export type PruneOption = {
  budsPerCane: number
  fertilityPct: number // fertilidade media da vara com esse comprimento
  canesPerArm: number
  canesPerPlant: number
  budsPerPlant: number
  bunchesPerPlant: number // esperados com essa poda
  grossTHa: number
  commercialTHa: number
  marginPct: number // quanto passa (ou falta) da meta
}

export type SimResult =
  | { ok: false; errors: string[] }
  | {
      ok: true
      plantsPerHa: number
      grossTHa: number
      kgPerPlant: number
      berriesPerBunch: number
      bunchesPerPlant: number
      bunchesPerArm: number
      fertileShootsPerPlant: number
      budsPerPlant: number
      budsPerArm: number
      fertilityUsedPct: number // da poda indicada
      splitFertility: boolean
      bunchesPerM2: number
      budsPerM2: number
      options: PruneOption[]
      recommended: PruneOption | null
      warnings: string[]
    }

/** Comprimentos de poda avaliados (gemas por vara). */
export const BUDS_PER_CANE = [4, 6, 8, 10, 12, 14] as const

/** Gemas da base da vara (trecho menos fertil). */
export const BASE_BUDS = 5

const pct = (v: number) => v / 100

export function simulate(i: SimInput): SimResult {
  const errors: string[] = []
  if (!(i.targetTHa > 0)) errors.push('Informe a meta de produção.')
  if (!(i.lossPct >= 0 && i.lossPct < 90)) errors.push('Perdas devem ficar entre 0 e 90%.')
  if (!(i.rowSpacingM > 0) || !(i.plantSpacingM > 0)) errors.push('Informe o espaçamento entre linhas e entre plantas.')
  if (!(i.armsPerPlant >= 1)) errors.push('Informe quantas saídas a planta tem.')
  if (!(i.berryWeightG > 0)) errors.push('Informe o peso médio da baga.')
  if (!(i.bunchWeightG > 0)) errors.push('Informe o peso do cacho.')
  if (i.bunchWeightG > 0 && i.berryWeightG > 0 && i.berryWeightG >= i.bunchWeightG)
    errors.push('O cacho precisa pesar mais que uma baga.')
  const split = Number.isFinite(i.tipFertilityPct)
  if (!(i.budFertilityPct > 0 && i.budFertilityPct <= 100)) errors.push('Fertilidade das gemas 1 a 5 entre 1 e 100%.')
  if (split && !(i.tipFertilityPct > 0 && i.tipFertilityPct <= 100)) errors.push('Fertilidade das gemas 6 em diante entre 1 e 100%.')
  if (!(i.budBreakPct > 0 && i.budBreakPct <= 100)) errors.push('Brotação entre 1 e 100%.')
  if (!(i.bunchesPerShoot > 0)) errors.push('Informe quantos cachos ficam por broto.')
  if (!(i.deadBudsPct >= 0 && i.deadBudsPct < 100)) errors.push('Gemas mortas/danificadas entre 0 e 99%.')
  if (errors.length) return { ok: false, errors }

  const areaPerPlant = i.rowSpacingM * i.plantSpacingM // m2
  const plantsPerHa = 10_000 / areaPerPlant
  const grossTHa = i.targetTHa / (1 - pct(i.lossPct))
  const kgPerPlant = (grossTHa * 1000) / plantsPerHa
  const bunchKg = i.bunchWeightG / 1000
  const bunchesPerPlant = kgPerPlant / bunchKg
  const fertileShootsPerPlant = bunchesPerPlant / i.bunchesPerShoot
  // Das gemas deixadas na poda: tira as mortas/danificadas, depois brotacao
  // e a fertilidade media da vara daquele comprimento.
  const alive = (1 - pct(i.deadBudsPct)) * pct(i.budBreakPct)
  const fBase = pct(i.budFertilityPct)
  const fTip = split ? pct(i.tipFertilityPct) : fBase
  const fertAt = (len: number) => (Math.min(len, BASE_BUDS) * fBase + Math.max(0, len - BASE_BUDS) * fTip) / len

  // Conferencia no sentido inverso: da poda ate' a tonelada.
  const forward = (budsPerCane: number, canesPerArm: number): PruneOption => {
    const fert = fertAt(budsPerCane)
    const budsP = budsPerCane * canesPerArm * i.armsPerPlant
    const bunchesP = budsP * alive * fert * i.bunchesPerShoot
    const gross = (bunchesP * bunchKg * plantsPerHa) / 1000
    const commercial = gross * (1 - pct(i.lossPct))
    return {
      budsPerCane,
      fertilityPct: fert * 100,
      canesPerArm,
      canesPerPlant: canesPerArm * i.armsPerPlant,
      budsPerPlant: budsP,
      bunchesPerPlant: bunchesP,
      grossTHa: gross,
      commercialTHa: commercial,
      marginPct: (commercial / i.targetTHa - 1) * 100,
    }
  }
  const options = BUDS_PER_CANE.map((len) => {
    const budsNeededPerArm = fertileShootsPerPlant / (alive * fertAt(len)) / i.armsPerPlant
    return forward(len, Math.max(1, Math.ceil(budsNeededPerArm / len - 1e-9)))
  })

  // Recomendada: entre as que batem a meta com sobra moderada (ate' 20
  // pontos acima da mais justa — em uva de mesa a sobra de cacho sai no
  // raleio), a de MENOS varas: menos vara para amarrar, conduzir e ralear.
  // No empate, a mais justa.
  const ok = options.filter((o) => o.marginPct >= -0.5)
  const tightest = Math.min(...ok.map((o) => o.marginPct))
  const recommended =
    ok.filter((o) => o.marginPct <= tightest + 20).sort((a, b) => a.canesPerArm - b.canesPerArm || a.marginPct - b.marginPct)[0] ??
    null

  // Gemas necessarias: pela fertilidade da poda indicada (com dois trechos,
  // ela muda com o comprimento da vara).
  const fertUsed = recommended ? pct(recommended.fertilityPct) : fertAt(BUDS_PER_CANE[BUDS_PER_CANE.length - 1])
  const budsPerPlant = fertileShootsPerPlant / (alive * fertUsed)
  const budsPerArm = budsPerPlant / i.armsPerPlant

  // --- alertas de consultor (faixas de referencia, nao regras fixas)
  const warnings: string[] = []
  const bunchesPerM2 = bunchesPerPlant / areaPerPlant
  const budsPerM2 = budsPerPlant / areaPerPlant
  const berriesPerBunch = i.bunchWeightG / i.berryWeightG
  if (bunchesPerM2 > 12)
    warnings.push(
      `${bunchesPerM2.toFixed(1)} cachos/m² é carga alta para uva de mesa: risco de cacho fraco, baga pequena e pouco açúcar. Reveja a meta ou o peso do cacho.`,
    )
  if (i.bunchesPerShoot > 1.5)
    warnings.push('Mais de 1,5 cacho por broto costuma comprometer tamanho e cor. Em uva de mesa o comum é deixar 1 cacho por broto.')
  if (fertUsed < 0.3)
    warnings.push(
      split
        ? `Fertilidade média de ${(fertUsed * 100).toFixed(0)}% na poda indicada: gemas pouco férteis pedem mais varas. Confira a análise de gemas.`
        : 'Fertilidade abaixo de 30%: confirme com a análise de gemas antes da poda — com gemas pouco férteis, vara mais longa ajuda.',
    )
  if (split && fTip < fBase)
    warnings.push('A ponta da vara ficou menos fértil que a base — o comum é o contrário. Confira se os dois números não foram trocados.')
  if (i.deadBudsPct > 15)
    warnings.push(`${i.deadBudsPct.toFixed(0)}% de gemas mortas ou danificadas é alto: vale investigar ácaro da gema e o manejo pós-colheita.`)
  if (i.budBreakPct < 70)
    warnings.push('Brotação abaixo de 70%: vale revisar a quebra de dormência (cianamida) e o estado das gemas.')
  if (!recommended || recommended.canesPerArm > 8)
    warnings.push('Mesmo com varas curtas seriam muitas varas por saída: a planta pode ficar sobrecarregada. Considere mais saídas por planta ou uma meta menor.')
  if (berriesPerBunch > 150)
    warnings.push(`${Math.round(berriesPerBunch)} bagas por cacho é muito para uva de mesa: o cacho fica compacto. Confira o peso do cacho e o da baga.`)
  if (kgPerPlant > 40) warnings.push(`${kgPerPlant.toFixed(1)} kg por planta é carga muito alta para uma planta só.`)

  return {
    ok: true,
    plantsPerHa,
    grossTHa,
    kgPerPlant,
    berriesPerBunch,
    bunchesPerPlant,
    bunchesPerArm: bunchesPerPlant / i.armsPerPlant,
    fertileShootsPerPlant,
    budsPerPlant,
    budsPerArm,
    fertilityUsedPct: fertUsed * 100,
    splitFertility: split,
    bunchesPerM2,
    budsPerM2,
    options,
    recommended,
    warnings,
  }
}
