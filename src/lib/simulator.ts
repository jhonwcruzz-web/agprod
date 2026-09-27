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
 */

export type SimInput = {
  targetTHa: number // meta comercial, t/ha
  lossPct: number // perdas na colheita e no packing, %
  rowSpacingM: number // entre linhas, m
  plantSpacingM: number // entre plantas, m
  armsPerPlant: number // saidas (bracos/cordoes) por planta
  berryWeightG: number // peso medio da baga, g
  bunchWeightG: number // peso do cacho comercial, g
  budFertilityPct: number // % das gemas que trazem cacho
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
  budBreakPct: 85,
  bunchesPerShoot: 1,
  deadBudsPct: 0,
}

export type PruneOption = {
  budsPerCane: number
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
      bunchesPerM2: number
      budsPerM2: number
      options: PruneOption[]
      recommended: PruneOption | null
      warnings: string[]
    }

/** Comprimentos de poda avaliados (gemas por vara). */
export const BUDS_PER_CANE = [4, 6, 8, 10, 12, 14] as const

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
  if (!(i.budFertilityPct > 0 && i.budFertilityPct <= 100)) errors.push('Fertilidade das gemas entre 1 e 100%.')
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
  // Das gemas deixadas na poda: tira as mortas/danificadas, depois brotacao e fertilidade.
  const budYield = (1 - pct(i.deadBudsPct)) * pct(i.budBreakPct) * pct(i.budFertilityPct)
  const budsPerPlant = fertileShootsPerPlant / budYield
  const budsPerArm = budsPerPlant / i.armsPerPlant

  // Conferencia no sentido inverso: da poda ate' a tonelada.
  const forward = (budsPerCane: number, canesPerArm: number): PruneOption => {
    const budsP = budsPerCane * canesPerArm * i.armsPerPlant
    const bunchesP = budsP * budYield * i.bunchesPerShoot
    const gross = (bunchesP * bunchKg * plantsPerHa) / 1000
    const commercial = gross * (1 - pct(i.lossPct))
    return {
      budsPerCane,
      canesPerArm,
      canesPerPlant: canesPerArm * i.armsPerPlant,
      budsPerPlant: budsP,
      bunchesPerPlant: bunchesP,
      grossTHa: gross,
      commercialTHa: commercial,
      marginPct: (commercial / i.targetTHa - 1) * 100,
    }
  }
  const options = BUDS_PER_CANE.map((g) => forward(g, Math.max(1, Math.ceil(budsPerArm / g - 1e-9))))

  // Recomendada: entre as que batem a meta com pouca sobra (ate' 10 pontos
  // acima da mais justa), a de MENOS varas — menos vara para amarrar,
  // conduzir e ralear. No empate, a mais justa.
  const ok = options.filter((o) => o.marginPct >= -0.5)
  const tightest = Math.min(...ok.map((o) => o.marginPct))
  const recommended =
    ok.filter((o) => o.marginPct <= tightest + 10).sort((a, b) => a.canesPerArm - b.canesPerArm || a.marginPct - b.marginPct)[0] ??
    null

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
  if (i.budFertilityPct < 30)
    warnings.push('Fertilidade abaixo de 30%: confirme com a análise de gemas antes da poda — com gemas pouco férteis, vara mais longa ajuda.')
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
    bunchesPerM2,
    budsPerM2,
    options,
    recommended,
    warnings,
  }
}
