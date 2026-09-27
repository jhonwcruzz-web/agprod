import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import { APP_NAME } from '@/lib/config'
import { date, LOG_TYPE_LABEL, meterUnit, num, UNIT_LABEL } from '@/lib/format'
import { formatPhone, ORDER_KIND_LABEL, ORDER_STATUS_LABEL, orderNumber, sprayMix } from '@/lib/orders'
import type { ServiceOrderDetail } from '@/lib/queries/orders'

/*
 * PDF da ordem de servico — o papel que vai para quem executa.
 *
 * Feito para ser lido no celular (WhatsApp) e tambem impresso: A4, letra
 * grande o bastante, preto no branco com um unico tom de verde, e campos
 * em branco para o executor preencher a' mao no campo.
 */

const A4: [number, number] = [595.28, 841.89]
const M = 40 // margem
const W = A4[0] - M * 2

const INK = rgb(0.13, 0.12, 0.1)
const MUTED = rgb(0.42, 0.39, 0.33)
const FAINT = rgb(0.7, 0.67, 0.6)
const LINE = rgb(0.84, 0.82, 0.76)
const SOFT = rgb(0.96, 0.95, 0.93)
const BRAND = rgb(0.184, 0.302, 0.212) // vine-700
const BRAND_SOFT = rgb(0.945, 0.965, 0.945)

// Caracteres que a fonte padrao (WinAnsi) sabe desenhar alem do Latin-1.
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')

/** A fonte embutida do PDF so' tem WinAnsi: o resto vira equivalente seguro. */
function safe(s: string) {
  let out = ''
  for (const ch of s.normalize('NFC')) {
    const c = ch.codePointAt(0)!
    if (ch === '\n' || ch === '\t') out += ' '
    else if (c === 0x202f || c === 0x2009) out += ' '
    else if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI_EXTRA.has(ch)) out += ch
    else if (ch === '≈') out += '~'
    else if (ch === '→') out += '->'
    else out += '?'
  }
  return out
}

class Doc {
  pdf: PDFDocument
  page!: PDFPage
  font!: PDFFont
  bold!: PDFFont
  y = 0 // distancia do topo

  constructor(pdf: PDFDocument) {
    this.pdf = pdf
  }

  static async create() {
    const d = new Doc(await PDFDocument.create())
    d.font = await d.pdf.embedFont(StandardFonts.Helvetica)
    d.bold = await d.pdf.embedFont(StandardFonts.HelveticaBold)
    d.newPage()
    return d
  }

  newPage() {
    this.page = this.pdf.addPage(A4)
    this.y = M
  }

  /** Garante espaco; se nao couber, continua na proxima pagina. */
  need(h: number) {
    if (this.y + h > A4[1] - M - 24) this.newPage()
  }

  width(text: string, size: number, bold = false) {
    return (bold ? this.bold : this.font).widthOfTextAtSize(safe(text), size)
  }

  text(text: string, x: number, size = 10, opts: { bold?: boolean; color?: RGB; top?: number } = {}) {
    const top = opts.top ?? this.y
    this.page.drawText(safe(text), {
      x,
      y: A4[1] - top - size,
      size,
      font: opts.bold ? this.bold : this.font,
      color: opts.color ?? INK,
    })
  }

  /** Quebra o texto na largura dada. */
  wrap(text: string, maxW: number, size: number, bold = false): string[] {
    const lines: string[] = []
    for (const para of safe(text).split(/\r?\n/)) {
      let cur = ''
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = cur ? `${cur} ${word}` : word
        if (this.width(next, size, bold) <= maxW) cur = next
        else {
          if (cur) lines.push(cur)
          cur = word
        }
      }
      lines.push(cur)
    }
    return lines
  }

  paragraph(text: string, size = 10, color: RGB = INK, maxW = W, x = M) {
    for (const line of this.wrap(text, maxW, size)) {
      this.need(size * 1.45)
      this.text(line, x, size, { color })
      this.y += size * 1.45
    }
  }

  hline(color: RGB = LINE, thickness = 0.75, x1 = M, x2 = M + W, top = this.y) {
    this.page.drawLine({
      start: { x: x1, y: A4[1] - top },
      end: { x: x2, y: A4[1] - top },
      thickness,
      color,
    })
  }

  rect(x: number, top: number, w: number, h: number, fill?: RGB, border?: RGB) {
    this.page.drawRectangle({
      x,
      y: A4[1] - top - h,
      width: w,
      height: h,
      color: fill,
      borderColor: border,
      borderWidth: border ? 0.75 : 0,
    })
  }

  section(title: string) {
    this.need(40)
    this.y += 10
    this.text(title.toUpperCase(), M, 8.5, { bold: true, color: BRAND })
    this.y += 12
    this.hline(BRAND, 1)
    this.y += 7
  }

  /** Pares rotulo/valor em colunas. */
  fields(items: [string, string | null | undefined][], cols = 2) {
    const list = items.filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== '—')
    if (list.length === 0) return
    const colW = W / cols
    for (let i = 0; i < list.length; i += cols) {
      const row = list.slice(i, i + cols)
      const wrapped = row.map(([, v]) => this.wrap(String(v), colW - 12, 10.5, true))
      const h = 11 + Math.max(...wrapped.map((l) => l.length)) * 13.5 + 5
      this.need(h)
      row.forEach(([label], j) => {
        const x = M + j * colW
        this.text(label, x, 8, { color: MUTED })
        wrapped[j].forEach((line, k) => this.text(line, x, 10.5, { bold: true, top: this.y + 11 + k * 13.5 }))
      })
      this.y += h
    }
  }

  /** Tabela simples com cabecalho sombreado. */
  table(cols: { header: string; width: number; align?: 'right' }[], rows: string[][], rowH = 22) {
    const total = cols.reduce((s, c) => s + c.width, 0)
    const widths = cols.map((c) => (c.width / total) * W)
    const drawHeader = () => {
      this.rect(M, this.y, W, 20, SOFT)
      let x = M
      cols.forEach((c, i) => {
        const tw = this.width(c.header, 8, true)
        this.text(c.header, c.align === 'right' ? x + widths[i] - 6 - tw : x + 6, 8, {
          bold: true,
          color: MUTED,
          top: this.y + 6,
        })
        x += widths[i]
      })
      this.y += 20
    }
    this.need(20 + rowH)
    drawHeader()
    for (const r of rows) {
      const wrapped = r.map((cell, i) => this.wrap(cell, widths[i] - 12, 10))
      const h = Math.max(rowH, 8 + Math.max(...wrapped.map((l) => l.length)) * 13)
      if (this.y + h > A4[1] - M - 24) {
        this.newPage()
        drawHeader()
      }
      let x = M
      wrapped.forEach((lines, i) => {
        lines.forEach((line, k) => {
          const tw = this.width(line, 10)
          this.text(line, cols[i].align === 'right' ? x + widths[i] - 6 - tw : x + 6, 10, {
            top: this.y + 6 + k * 13,
          })
        })
        x += widths[i]
      })
      this.y += h
      this.hline()
    }
  }

  /** Linha para preencher a' mao: "Rotulo ________". */
  blanks(labels: string[], cols = 2) {
    const colW = W / cols
    // Rotulo em cima, linha embaixo: cabe em colunas estreitas.
    for (let i = 0; i < labels.length; i += cols) {
      this.need(34)
      labels.slice(i, i + cols).forEach((label, j) => {
        const x = M + j * colW
        this.text(label, x, 8, { color: MUTED, top: this.y + 2 })
        this.hline(FAINT, 0.75, x, x + colW - 14, this.y + 28)
      })
      this.y += 34
    }
  }

  writeLines(n: number) {
    for (let i = 0; i < n; i++) {
      this.need(22)
      this.y += 22
      this.hline(FAINT)
    }
  }

  checklist(items: string[]) {
    for (const item of items) {
      const lines = this.wrap(item, W - 24, 10.5)
      this.need(lines.length * 14 + 10)
      this.rect(M, this.y + 1, 10, 10, undefined, INK)
      lines.forEach((l, k) => this.text(l, M + 20, 10.5, { top: this.y + k * 14 }))
      this.y += lines.length * 14 + 8
    }
  }

  signatures(labels: string[]) {
    this.need(70)
    this.y += 38
    const gap = 30
    const w = (W - gap * (labels.length - 1)) / labels.length
    labels.forEach((l, i) => {
      const x = M + i * (w + gap)
      this.hline(INK, 0.75, x, x + w)
      this.text(l, x, 8.5, { color: MUTED, top: this.y + 5 })
    })
    this.y += 24
  }
}

function machineLine(m: ServiceOrderDetail['machine']) {
  if (!m) return null
  return [m.name, [m.brand, m.model].filter(Boolean).join(' '), m.identifier].filter(Boolean).join(' · ')
}

/** Hora de Brasilia (o servidor da Vercel roda em UTC). */
function brTime(iso: string, withTime = true) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

const PLURAL: Record<string, string> = { caixa: 'caixas', saco: 'sacos', unidade: 'unidades', dose: 'doses' }
const qty = (v: number | null, unit: string) =>
  v === null ? '—' : `${num(v, 2)} ${v > 1 && PLURAL[unit] ? PLURAL[unit] : (UNIT_LABEL[unit] ?? unit)}`

export async function buildServiceOrderPdf(os: ServiceOrderDetail): Promise<Uint8Array> {
  const d = await Doc.create()
  const kindLabel = ORDER_KIND_LABEL[os.kind]
  const nro = orderNumber(os.number)

  d.pdf.setTitle(`OS ${nro} — ${kindLabel} — ${os.farm.name}`)
  d.pdf.setAuthor(os.farm.name)
  d.pdf.setCreator(APP_NAME)
  d.pdf.setProducer(APP_NAME)

  // ------------------------------------------------------------ cabecalho
  const place = [os.farm.community, os.farm.city && os.farm.state ? `${os.farm.city}/${os.farm.state}` : os.farm.city]
    .filter(Boolean)
    .join(' · ')
  d.text(os.farm.name, M, 15, { bold: true })
  d.text([place, os.farm.phone].filter(Boolean).join(' · ') || ' ', M, 9, { color: MUTED, top: d.y + 20 })
  if (os.farm.owner_name) d.text(`Responsável: ${os.farm.owner_name}`, M, 9, { color: MUTED, top: d.y + 32 })

  const boxW = 170
  const bx = M + W - boxW
  d.rect(bx, d.y - 4, boxW, 58, BRAND)
  d.text('ORDEM DE SERVIÇO', bx + 12, 8, { bold: true, color: rgb(0.75, 0.84, 0.76), top: d.y + 4 })
  d.text(`Nº ${nro}`, bx + 12, 20, { bold: true, color: rgb(1, 1, 1), top: d.y + 16 })
  d.text(kindLabel.toUpperCase(), bx + 12, 9, { bold: true, color: rgb(1, 1, 1), top: d.y + 40 })
  d.y += 66

  // faixa de datas
  d.rect(M, d.y, W, 34, BRAND_SOFT)
  const strip: [string, string][] = [
    ['Data prevista', date(os.scheduled_date)],
    ['Emitida em', brTime(new Date().toISOString())],
    ['Safra', os.season ?? '—'],
    ['Situação', ORDER_STATUS_LABEL[os.status] + (os.completed_at ? ` em ${brTime(os.completed_at, false)}` : '')],
  ]
  strip.forEach(([k, v], i) => {
    const x = M + 10 + i * (W / 4)
    d.text(k, x, 7.5, { color: MUTED, top: d.y + 6 })
    d.text(v, x, 10, { bold: true, top: d.y + 17 })
  })
  d.y += 40

  // ------------------------------------------------------------ executor
  d.section('Quem executa')
  d.fields([
    ['Responsável pela execução', os.assignee ?? 'A definir'],
    ['Telefone / WhatsApp', formatPhone(os.assignee_phone)],
  ])

  // ------------------------------------------------------------ por tipo
  const plotName = os.plot ? [os.plot.code, os.plot.name].filter(Boolean).join(' — ') : null
  const cropVar = [os.plot?.crops?.name, os.variety].filter(Boolean).join(' · ') || null

  if (os.kind === 'pulverizacao') {
    const areaHa = os.area === null ? (os.plot ? Number(os.plot.area) : null) : Number(os.area)
    const sprayLha = os.spray_volume === null ? null : Number(os.spray_volume)
    const tankL = os.tank_capacity === null ? null : Number(os.tank_capacity)
    const mix = sprayMix(areaHa, sprayLha, tankL)

    d.section('Local')
    d.fields([
      ['Talhão', plotName],
      ['Cultura / variedade', cropVar],
      ['Área a pulverizar', areaHa ? `${num(areaHa, 2)} ha` : null],
      ['Plantas', os.plot?.plant_count ? num(os.plot.plant_count) : null],
    ], 4)

    d.section('Equipamento e calda')
    d.fields([
      ['Trator', machineLine(os.machine)],
      ['Pulverizador / implemento', machineLine(os.implement)],
      ['Volume de calda', sprayLha ? `${num(sprayLha)} L/ha` : null],
      ['Calda total', mix.totalL ? `${num(mix.totalL)} L` : null],
      ['Capacidade do tanque', tankL ? `${num(tankL)} L` : null],
      [
        'Tanques',
        mix.tanks ? `${mix.tanksRounded} ${mix.tanksRounded === 1 ? 'tanque' : 'tanques'} (${num(mix.tanks, 2)} cheios)` : null,
      ],
    ], 3)

    d.section('Produtos da calda')
    const perTank = (total: number | null) =>
      total !== null && mix.totalL && tankL ? (total * tankL) / mix.totalL : null
    const showTank = !!(mix.totalL && tankL)
    d.table(
      [
        { header: 'Produto', width: 30 },
        { header: 'Princípio ativo', width: 22 },
        { header: 'Dose', width: 15, align: 'right' },
        { header: 'Total na área', width: 16, align: 'right' },
        ...(showTank ? [{ header: 'Por tanque cheio', width: 17, align: 'right' as const }] : []),
      ],
      os.products.map((p) => [
        p.name,
        p.activeIngredient ?? '—',
        p.dose === null ? '—' : `${num(p.dose, 2)} ${p.doseUnit ?? ''}`,
        qty(p.total, p.unit),
        ...(showTank ? [qty(perTank(p.total), p.unit)] : []),
      ]),
    )

    d.section('Segurança')
    d.paragraph(
      'Use EPI completo: luvas, máscara, avental, botas, óculos e boné árabe. Não pulverize com vento forte, ' +
        'chuva prevista ou nas horas mais quentes do dia. Respeite o intervalo de reentrada e a carência ' +
        'indicados no rótulo de cada produto. Faça a tríplice lavagem e devolva as embalagens vazias.',
      9.5,
      MUTED,
    )
  } else if (os.kind === 'colheita') {
    d.section('Local')
    d.fields([
      ['Talhão', plotName],
      ['Cultura / variedade', cropVar],
      ['Área', os.plot ? `${num(Number(os.plot.area), 2)} ha` : null],
      ['Plantas', os.plot?.plant_count ? num(os.plot.plant_count) : null],
    ], 4)
    d.section('O que colher')
    d.fields([
      ['Quantidade prevista', os.expected_quantity ? qty(Number(os.expected_quantity), os.expected_unit ?? 'kg') : null],
      ['Destino', os.destination],
      ['Tamanho da turma', os.team_size ? `${os.team_size} pessoas` : null],
    ], 3)
  } else {
    const m = os.machine
    d.section('Máquina')
    d.fields([
      ['Máquina', m?.name],
      ['Tipo', m?.kind],
      ['Marca / modelo', [m?.brand, m?.model].filter(Boolean).join(' ') || null],
      ['Identificação', m?.identifier],
      [
        m?.meter_type === 'km' ? 'Odômetro atual' : 'Horímetro atual',
        m && m.meter_type !== 'nenhum' ? `${num(Number(m.current_meter))} ${meterUnit(m.meter_type)}` : null,
      ],
      ['Serviço', os.log_type ? LOG_TYPE_LABEL[os.log_type] : null],
      ['Talhão', plotName],
    ], 3)
    const items = (os.checklist ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    if (items.length) {
      d.section('O que fazer')
      d.checklist(items)
    }
  }

  if (os.instructions) {
    d.section('Instruções')
    d.paragraph(os.instructions, 10.5)
  }

  // ------------------------------------------------------ preencher no campo
  d.section('Preencher na execução')
  if (os.kind === 'pulverizacao') {
    d.blanks(['Data', 'Hora início', 'Hora fim', 'Tanques aplicados', 'Temperatura (°C)', 'Umidade (%)', 'Vento (km/h)', 'Horímetro'], 4)
  } else if (os.kind === 'colheita') {
    d.table(
      [
        { header: 'Data', width: 16 },
        { header: 'Início', width: 12 },
        { header: 'Fim', width: 12 },
        { header: 'Caixas / kg colhidos', width: 25 },
        { header: 'Responsável', width: 35 },
      ],
      Array.from({ length: 5 }, () => ['', '', '', '', '']),
      24,
    )
  } else {
    d.blanks(['Data', 'Horímetro / odômetro', 'Horas de serviço', 'Valor (R$)'], 4)
    d.text('Peças e materiais usados', M, 9, { color: MUTED, top: d.y + 4 })
    d.y += 10
    d.writeLines(3)
  }
  d.need(60)
  d.text('Observações', M, 8, { color: MUTED, top: d.y + 6 })
  d.y += 8
  d.writeLines(2)

  d.signatures(
    os.kind === 'pulverizacao'
      ? ['Produtor / responsável técnico', 'Aplicador']
      : os.kind === 'colheita'
        ? ['Produtor', 'Encarregado da turma']
        : ['Produtor', 'Mecânico / oficina'],
  )

  // ------------------------------------------------------------ rodape
  const pages = d.pdf.getPages()
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 30 }, end: { x: M + W, y: 30 }, thickness: 0.5, color: LINE })
    p.drawText(safe(`${APP_NAME} · OS ${nro} · ${kindLabel} · ${os.farm.name}`), {
      x: M,
      y: 18,
      size: 7.5,
      font: d.font,
      color: FAINT,
    })
    const label = `página ${i + 1} de ${pages.length}`
    p.drawText(label, { x: M + W - d.font.widthOfTextAtSize(label, 7.5), y: 18, size: 7.5, font: d.font, color: FAINT })
  })

  return d.pdf.save()
}
