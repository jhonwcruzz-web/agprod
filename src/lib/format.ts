/** Formatadores pt-BR. Centralizados para que os numeros fiquem iguais
 *  em toda a aplicacao — o produtor precisa reconhecer o formato. */

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
})

const brlCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const dec = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const dec0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

export function money(v: number | null | undefined, opts?: { compact?: boolean }) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return opts?.compact && Math.abs(v) >= 10_000 ? brlCompact.format(v) : brl.format(v)
}

export function num(v: number | null | undefined, digits = 0) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return digits === 0 ? dec0.format(v) : dec.format(v)
}

/** Massa. Acima de 1 t mostra a tonelada, que e' como o produtor fala. */
export function kg(v: number | null | undefined, opts?: { asTon?: boolean }) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  if (opts?.asTon && Math.abs(v) >= 1000) return `${dec.format(v / 1000)} t`
  return `${dec0.format(v)} kg`
}

export function area(v: number | null | undefined, unit = 'ha') {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return `${dec.format(v)} ${unit}`
}

export function pct(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return `${dec0.format(v)}%`
}

/** Data sem fuso: strings 'YYYY-MM-DD' do Postgres nao devem virar Date(),
 *  senao o dia muda conforme o fuso do navegador. */
export function date(v: string | null | undefined, opts?: { short?: boolean }) {
  if (!v) return '—'
  const [y, m, d] = v.slice(0, 10).split('-')
  return opts?.short ? `${d}/${m}` : `${d}/${m}/${y}`
}

export function dateTime(v: string | null | undefined) {
  if (!v) return '—'
  const dt = new Date(v)
  return dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** "há 3 dias" — usado nos alertas e na aba de atividade do talhao. */
export function sinceDays(v: string | null | undefined): number | null {
  if (!v) return null
  const [y, m, d] = v.slice(0, 10).split('-').map(Number)
  const then = Date.UTC(y, m - 1, d)
  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((today - then) / 86_400_000)
}

export function relativeDay(v: string | null | undefined) {
  const n = sinceDays(v)
  if (n === null) return '—'
  if (n === 0) return 'hoje'
  if (n === 1) return 'ontem'
  if (n === -1) return 'amanhã'
  if (n < 0) return `em ${Math.abs(n)} dias`
  return `há ${n} dias`
}

export function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** CPF/CNPJ apenas para exibicao. */
export function taxId(v: string | null | undefined) {
  if (!v) return '—'
  const s = v.replace(/\D/g, '')
  if (s.length === 11) return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (s.length === 14) return s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return v
}

export const UNIT_LABEL: Record<string, string> = {
  kg: 'kg', t: 't', caixa: 'caixa', unidade: 'un', L: 'L', g: 'g', mL: 'mL',
  saco: 'saco', dose: 'dose',
}

export const EXPENSE_LABEL: Record<string, string> = {
  mao_de_obra: 'Mão de obra',
  adubacao: 'Adubação',
  fitossanidade: 'Fitossanidade',
  irrigacao: 'Irrigação',
  combustivel: 'Combustível',
  energia: 'Energia',
  manutencao: 'Manutenção',
  maquinas: 'Máquinas',
  embalagens: 'Embalagens',
  frete: 'Frete',
  servicos: 'Serviços',
  outros: 'Outros',
}

export const PRODUCT_LABEL: Record<string, string> = {
  fertilizante: 'Fertilizante',
  defensivo: 'Defensivo',
  corretivo: 'Corretivo',
  material: 'Material',
  embalagem: 'Embalagem',
  combustivel: 'Combustível',
  outro: 'Outro',
}

export const PLOT_STATUS_LABEL: Record<string, string> = {
  producao: 'Em produção',
  formacao: 'Em formação',
  repouso: 'Em repouso',
  inativo: 'Inativo',
}

// ------------------------------------------------ maquinas e implementos

export const MACHINE_CLASS_LABEL: Record<string, string> = {
  maquina: 'Máquina',
  implemento: 'Implemento',
}

/** Sugestoes de tipo por classe — o campo aceita texto livre. */
export const MACHINE_KINDS: Record<string, string[]> = {
  maquina: ['Trator', 'Pulverizador autopropelido', 'Veículo', 'Motocicleta', 'Caminhão', 'Motobomba', 'Gerador', 'Roçadeira costal'],
  implemento: ['Grade', 'Roçadeira', 'Atomizador', 'Pulverizador de arrasto', 'Carreta', 'Subsolador', 'Enxada rotativa', 'Plaina', 'Distribuidor de adubo'],
}

export const MACHINE_STATUS_LABEL: Record<string, string> = {
  operacional: 'Operacional',
  manutencao: 'Em manutenção',
  inativo: 'Inativo',
}

export const LOG_TYPE_LABEL: Record<string, string> = {
  preventiva: 'Manutenção preventiva',
  corretiva: 'Conserto',
  revisao: 'Revisão',
  abastecimento: 'Abastecimento',
}

/** Unidade do horimetro/odometro. */
export function meterUnit(t: string | null | undefined) {
  return t === 'km' ? 'km' : t === 'horas' ? 'h' : ''
}
