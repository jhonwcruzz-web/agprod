'use client'

import { useState } from 'react'
import type { Route } from 'next'
import { Field, Input, InputWithUnit, Select, Textarea } from '@/components/ui/Field'
import { CreatableSelect } from '@/components/ui/CreatableSelect'
import {
  FormGrid,
  FormPanel,
  plotLabel,
  type Option,
  type PlotOption,
  type VarietyOption,
} from './FormPanel'
import {
  createApplication,
  createExpense,
  createFertilization,
  createHarvestDestination,
  createIrrigation,
  createProduction,
  createSale,
} from '@/lib/actions/records'
import { EXPENSE_LABEL, today } from '@/lib/format'

/** Unidades que ja' sao massa — as demais exigem o peso unitario. */
const MASS_UNITS = ['kg', 't', 'g']
const HARVEST_UNITS = ['kg', 'caixa', 't', 'unidade'] as const
const SALE_UNITS = ['kg', 'caixa', 't'] as const

function PlotField({ plots, required }: { plots: PlotOption[]; required?: boolean }) {
  return (
    <Field label="Talhão" htmlFor="plot_id" required={required}>
      <Select id="plot_id" name="plot_id" required={required} defaultValue="">
        <option value="">—</option>
        {plots.map((p) => (
          <option key={p.id} value={p.id}>
            {plotLabel(p)}
          </option>
        ))}
      </Select>
    </Field>
  )
}

/**
 * Talhao e variedade ligados: ao escolher o talhao, a variedade cadastrada
 * nele vem preenchida, e a lista mostra so' variedades da cultura dele.
 * Continua editavel para o caso raro de um talhao com replantio.
 */
function usePlotVariety(plots: PlotOption[], varieties: VarietyOption[]) {
  const [plotId, setPlotId] = useState('')
  const [varietyId, setVarietyId] = useState('')
  const plot = plots.find((p) => p.id === plotId)

  const list = plot?.crop_id
    ? varieties.filter((v) => v.crop_id === plot.crop_id || v.id === varietyId)
    : varieties

  function selectPlot(id: string) {
    setPlotId(id)
    setVarietyId(plots.find((p) => p.id === id)?.variety_id ?? '')
  }

  const fromPlot = !!plot?.variety_id && plot.variety_id === varietyId
  const hint = !plot
    ? 'Vem do cadastro do talhão.'
    : !plot.variety_id
      ? 'Este talhão não tem variedade cadastrada.'
      : fromPlot
        ? 'Preenchida pelo cadastro do talhão.'
        : 'Diferente da cadastrada no talhão.'

  return { plotId, selectPlot, varietyId, setVarietyId, list, hint }
}

/* ------------------------------------------------------------ COLHEITA */

export function ProductionForm({
  plots,
  varieties,
  destinations,
  closeHref,
}: {
  plots: PlotOption[]
  varieties: VarietyOption[]
  destinations: { name: string }[]
  closeHref: Route
}) {
  const [unit, setUnit] = useState<string>('kg')
  const needsWeight = !MASS_UNITS.includes(unit)
  const pv = usePlotVariety(plots, varieties)

  return (
    <FormPanel
      action={createProduction}
      title="Registrar colheita"
      description="Data, talhão e quantidade bastam. O resto é opcional."
      closeHref={closeHref}
      submitLabel="Registrar colheita"
    >
      <FormGrid>
        <Field label="Data" htmlFor="harvest_date" required>
          <Input
            id="harvest_date"
            name="harvest_date"
            type="date"
            defaultValue={today()}
            required
            className="num"
          />
        </Field>

        <Field label="Talhão" htmlFor="plot_id" required>
          <Select
            id="plot_id"
            name="plot_id"
            required
            value={pv.plotId}
            onChange={(e) => pv.selectPlot(e.target.value)}
          >
            <option value="">—</option>
            {plots.map((p) => (
              <option key={p.id} value={p.id}>
                {plotLabel(p)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Variedade" htmlFor="variety_id" hint={pv.hint}>
          <Select
            id="variety_id"
            name="variety_id"
            value={pv.varietyId}
            onChange={(e) => pv.setVarietyId(e.target.value)}
          >
            <option value="">—</option>
            {pv.list.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Quantidade" htmlFor="quantity" required>
          <Input
            id="quantity"
            name="quantity"
            inputMode="decimal"
            required
            placeholder="900"
            className="num"
          />
        </Field>

        <Field label="Unidade" htmlFor="unit">
          <Select id="unit" name="unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {HARVEST_UNITS.map((u) => (
              <option key={u} value={u}>
                {u === 'unidade' ? 'unidade' : u}
              </option>
            ))}
          </Select>
        </Field>

        {needsWeight && (
          <Field
            label={`Peso de cada ${unit}`}
            htmlFor="unit_weight_kg"
            hint="Necessário para calcular custo por kg."
            required
          >
            <InputWithUnit
              id="unit_weight_kg"
              name="unit_weight_kg"
              unit="kg"
              inputMode="decimal"
              placeholder="8,5"
              required
            />
          </Field>
        )}

        <Field label="Destino" htmlFor="destination" hint="Use o + para criar outra opção.">
          <CreatableSelect
            id="destination"
            name="destination"
            options={destinations.map((d) => ({ value: d.name, label: d.name }))}
            addLabel="Novo destino"
            onCreate={async (label) => {
              const res = await createHarvestDestination(label)
              return 'error' in res ? res : { value: res.name, label: res.name }
            }}
          />
        </Field>

        <Field label="Equipe" htmlFor="team">
          <Input id="team" name="team" placeholder="Turma da colheita" />
        </Field>
      </FormGrid>
    </FormPanel>
  )
}

/* ----------------------------------------------------------- APLICACAO */

export function ApplicationForm({
  plots,
  products,
  closeHref,
}: {
  plots: PlotOption[]
  products: (Option & { unit: string; active_ingredient: string | null })[]
  closeHref: Route
}) {
  const [status, setStatus] = useState('realizada')
  const [productId, setProductId] = useState('')
  const product = products.find((p) => p.id === productId)

  return (
    <FormPanel
      action={createApplication}
      title="Registrar aplicação"
      description="Ao marcar como realizada, o estoque do produto é baixado automaticamente."
      closeHref={closeHref}
      submitLabel="Registrar aplicação"
    >
      <FormGrid>
        <Field label="Situação" htmlFor="status">
          <Select
            id="status"
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="realizada">Realizada</option>
            <option value="programada">Programada</option>
            <option value="pendente">Pendente</option>
          </Select>
        </Field>

        {status === 'programada' ? (
          <Field label="Data prevista" htmlFor="scheduled_date" required>
            <Input
              id="scheduled_date"
              name="scheduled_date"
              type="date"
              defaultValue={today()}
              required
              className="num"
            />
          </Field>
        ) : (
          <Field label="Data da aplicação" htmlFor="application_date" required>
            <Input
              id="application_date"
              name="application_date"
              type="date"
              defaultValue={today()}
              required
              className="num"
            />
          </Field>
        )}

        <PlotField plots={plots} />

        <Field
          label="Produto do estoque"
          htmlFor="product_id"
          hint="Escolha para dar baixa automática."
        >
          <Select
            id="product_id"
            name="product_id"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">Fora do estoque</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Nome do produto" htmlFor="product_name" required>
          <Input
            id="product_name"
            name="product_name"
            required
            defaultValue={product?.name ?? ''}
            key={productId}
            placeholder="Nome comercial"
          />
        </Field>

        <Field label="Ingrediente ativo" htmlFor="active_ingredient">
          <Input
            id="active_ingredient"
            name="active_ingredient"
            defaultValue={product?.active_ingredient ?? ''}
            key={`ia-${productId}`}
          />
        </Field>

        <Field label="Dose" htmlFor="dose">
          <Input id="dose" name="dose" inputMode="decimal" placeholder="2,5" className="num" />
        </Field>

        <Field label="Unidade da dose" htmlFor="dose_unit">
          <Select id="dose_unit" name="dose_unit" defaultValue="L/ha">
            {['L/ha', 'kg/ha', 'mL/ha', 'g/ha', 'mL/100L', 'g/100L'].map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Área aplicada" htmlFor="area" hint="Vazio usa a área do talhão.">
          <InputWithUnit id="area" name="area" unit="ha" inputMode="decimal" />
        </Field>

        <Field
          label="Quantidade total usada"
          htmlFor="total_quantity"
          hint={product ? `Baixa do estoque em ${product.unit}.` : 'Vazio calcula dose × área.'}
        >
          <Input
            id="total_quantity"
            name="total_quantity"
            inputMode="decimal"
            className="num"
          />
        </Field>

        <Field label="Volume de calda" htmlFor="spray_volume">
          <InputWithUnit id="spray_volume" name="spray_volume" unit="L" inputMode="decimal" />
        </Field>

        <Field label="Custo" htmlFor="cost">
          <InputWithUnit
            id="cost"
            name="cost"
            unit="R$"
            inputMode="decimal"
            placeholder="0,00"
          />
        </Field>

        <Field label="Equipamento" htmlFor="equipment">
          <Input id="equipment" name="equipment" placeholder="Turbo atomizador" />
        </Field>

        <Field label="Responsável" htmlFor="responsible">
          <Input id="responsible" name="responsible" />
        </Field>
      </FormGrid>
    </FormPanel>
  )
}

/* ------------------------------------------------------------ ADUBACAO */

export function FertilizationForm({
  plots,
  products,
  closeHref,
}: {
  plots: PlotOption[]
  products: (Option & { unit: string })[]
  closeHref: Route
}) {
  const [productId, setProductId] = useState('')
  const product = products.find((p) => p.id === productId)

  return (
    <FormPanel
      action={createFertilization}
      title="Registrar adubação"
      description="O estoque do fertilizante é baixado automaticamente."
      closeHref={closeHref}
      submitLabel="Registrar adubação"
    >
      <FormGrid>
        <Field label="Data" htmlFor="fertilization_date" required>
          <Input
            id="fertilization_date"
            name="fertilization_date"
            type="date"
            defaultValue={today()}
            required
            className="num"
          />
        </Field>

        <PlotField plots={plots} />

        <Field label="Produto do estoque" htmlFor="product_id">
          <Select
            id="product_id"
            name="product_id"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">Fora do estoque</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Nome do produto" htmlFor="product_name" required>
          <Input
            id="product_name"
            name="product_name"
            required
            defaultValue={product?.name ?? ''}
            key={productId}
            placeholder="20-05-20"
          />
        </Field>

        <Field label="Quantidade" htmlFor="quantity" required>
          <Input
            id="quantity"
            name="quantity"
            inputMode="decimal"
            required
            placeholder="200"
            className="num"
          />
        </Field>

        <Field label="Unidade" htmlFor="unit">
          <Select id="unit" name="unit" defaultValue={product?.unit ?? 'kg'} key={`u-${productId}`}>
            {['kg', 'saco', 'L', 't'].map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Tipo" htmlFor="fert_type">
          <Select id="fert_type" name="fert_type" defaultValue="">
            <option value="">—</option>
            {['Cobertura', 'Fundação', 'Foliar', 'Fertirrigação', 'Orgânico', 'Corretivo'].map(
              (t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ),
            )}
          </Select>
        </Field>

        <Field label="Forma de aplicação" htmlFor="application_method">
          <Input id="application_method" name="application_method" placeholder="Fertirrigação" />
        </Field>

        <Field label="Custo" htmlFor="cost">
          <InputWithUnit id="cost" name="cost" unit="R$" inputMode="decimal" placeholder="0,00" />
        </Field>

        <Field label="Área" htmlFor="area" hint="Vazio usa a área do talhão.">
          <InputWithUnit id="area" name="area" unit="ha" inputMode="decimal" />
        </Field>

        <Field label="Responsável" htmlFor="responsible">
          <Input id="responsible" name="responsible" />
        </Field>
      </FormGrid>
    </FormPanel>
  )
}

/* ----------------------------------------------------------- IRRIGACAO */

export function IrrigationForm({
  plots,
  closeHref,
}: {
  plots: PlotOption[]
  closeHref: Route
}) {
  return (
    <FormPanel
      action={createIrrigation}
      title="Registrar irrigação"
      description="Registrar a irrigação é o que permite avisar quando um talhão fica dias sem água."
      closeHref={closeHref}
      submitLabel="Registrar irrigação"
    >
      <FormGrid>
        <Field label="Data" htmlFor="irrigation_date" required>
          <Input
            id="irrigation_date"
            name="irrigation_date"
            type="date"
            defaultValue={today()}
            required
            className="num"
          />
        </Field>

        <PlotField plots={plots} required />

        <Field label="Duração" htmlFor="duration_minutes">
          <InputWithUnit
            id="duration_minutes"
            name="duration_minutes"
            unit="min"
            inputMode="numeric"
            placeholder="120"
          />
        </Field>

        <Field label="Volume" htmlFor="volume_m3">
          <InputWithUnit id="volume_m3" name="volume_m3" unit="m³" inputMode="decimal" />
        </Field>

        <Field label="Método" htmlFor="method">
          <Select id="method" name="method" defaultValue="">
            <option value="">—</option>
            {['Gotejamento', 'Microaspersão', 'Aspersão', 'Sulco'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Custo" htmlFor="cost" hint="Energia, bombeamento.">
          <InputWithUnit id="cost" name="cost" unit="R$" inputMode="decimal" placeholder="0,00" />
        </Field>

        <Field label="Responsável" htmlFor="responsible">
          <Input id="responsible" name="responsible" />
        </Field>
      </FormGrid>
    </FormPanel>
  )
}

/* -------------------------------------------------------------- CUSTOS */

export function ExpenseForm({
  plots,
  closeHref,
}: {
  plots: PlotOption[]
  closeHref: Route
}) {
  const [status, setStatus] = useState('pago')

  return (
    <FormPanel
      action={createExpense}
      title="Registrar despesa"
      description="Informe só o essencial: categoria, descrição e valor."
      closeHref={closeHref}
      submitLabel="Registrar despesa"
    >
      <FormGrid>
        <Field label="Categoria" htmlFor="category" required>
          <Select id="category" name="category" defaultValue="mao_de_obra" required>
            {Object.entries(EXPENSE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Descrição" htmlFor="description" required className="sm:col-span-2">
          <Input
            id="description"
            name="description"
            required
            placeholder="Diária da turma de poda"
          />
        </Field>

        <Field label="Valor" htmlFor="amount" required>
          <InputWithUnit
            id="amount"
            name="amount"
            unit="R$"
            inputMode="decimal"
            required
            placeholder="2400,00"
          />
        </Field>

        <Field label="Data" htmlFor="expense_date" required>
          <Input
            id="expense_date"
            name="expense_date"
            type="date"
            defaultValue={today()}
            required
            className="num"
          />
        </Field>

        <Field
          label="Talhão"
          htmlFor="plot_id"
          hint="Vincule para entrar no custo por kg do talhão."
        >
          <Select id="plot_id" name="plot_id" defaultValue="">
            <option value="">Custo geral da propriedade</option>
            {plots.map((p) => (
              <option key={p.id} value={p.id}>
                {plotLabel(p)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Situação" htmlFor="status">
          <Select
            id="status"
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="pago">Já paguei</option>
            <option value="pendente">A pagar</option>
          </Select>
        </Field>

        {status !== 'pago' && (
          <Field label="Vencimento" htmlFor="due_date">
            <Input id="due_date" name="due_date" type="date" className="num" />
          </Field>
        )}

        <Field label="Fornecedor" htmlFor="supplier">
          <Input id="supplier" name="supplier" />
        </Field>
      </FormGrid>
    </FormPanel>
  )
}

/* --------------------------------------------------------------- VENDA */

export function SaleForm({
  plots,
  buyers,
  varieties,
  closeHref,
}: {
  plots: PlotOption[]
  buyers: Option[]
  varieties: VarietyOption[]
  closeHref: Route
}) {
  const [unit, setUnit] = useState<string>('kg')
  const [received, setReceived] = useState('nao')
  const needsWeight = !MASS_UNITS.includes(unit)
  const pv = usePlotVariety(plots, varieties)

  return (
    <FormPanel
      action={createSale}
      title="Registrar venda"
      description="Quanto vendeu, para quem e por quanto. O a receber aparece sozinho."
      closeHref={closeHref}
      submitLabel="Registrar venda"
    >
      <FormGrid>
        <Field label="Data" htmlFor="sale_date" required>
          <Input
            id="sale_date"
            name="sale_date"
            type="date"
            defaultValue={today()}
            required
            className="num"
          />
        </Field>

        <Field label="Comprador" htmlFor="buyer_id" required>
          <Select id="buyer_id" name="buyer_id" required defaultValue="">
            <option value="">—</option>
            {buyers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Quantidade" htmlFor="quantity" required>
          <Input
            id="quantity"
            name="quantity"
            inputMode="decimal"
            required
            placeholder="800"
            className="num"
          />
        </Field>

        <Field label="Unidade" htmlFor="unit">
          <Select id="unit" name="unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {SALE_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>

        {needsWeight && (
          <Field label={`Peso de cada ${unit}`} htmlFor="unit_weight_kg" required>
            <InputWithUnit
              id="unit_weight_kg"
              name="unit_weight_kg"
              unit="kg"
              inputMode="decimal"
              required
              placeholder="8,5"
            />
          </Field>
        )}

        <Field label="Preço por kg" htmlFor="price_per_kg" required>
          <InputWithUnit
            id="price_per_kg"
            name="price_per_kg"
            unit="R$"
            inputMode="decimal"
            placeholder="6,20"
          />
        </Field>

        <Field
          label="Valor total"
          htmlFor="total_amount"
          hint="Vazio calcula quantidade × preço."
        >
          <InputWithUnit id="total_amount" name="total_amount" unit="R$" inputMode="decimal" />
        </Field>

        <Field label="Talhão de origem" htmlFor="plot_id">
          <Select
            id="plot_id"
            name="plot_id"
            value={pv.plotId}
            onChange={(e) => pv.selectPlot(e.target.value)}
          >
            <option value="">—</option>
            {plots.map((p) => (
              <option key={p.id} value={p.id}>
                {plotLabel(p)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Variedade" htmlFor="variety_id" hint={pv.hint}>
          <Select
            id="variety_id"
            name="variety_id"
            value={pv.varietyId}
            onChange={(e) => pv.setVarietyId(e.target.value)}
          >
            <option value="">—</option>
            {pv.list.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Forma de pagamento" htmlFor="payment_method">
          <Select id="payment_method" name="payment_method" defaultValue="">
            <option value="">—</option>
            {['Pix', 'Dinheiro', 'Transferência', 'Cheque', 'Boleto', 'Prazo'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Já recebeu?" htmlFor="recebeu">
          <Select
            id="recebeu"
            value={received}
            onChange={(e) => setReceived(e.target.value)}
          >
            <option value="nao">Ainda não</option>
            <option value="sim">Sim, recebi tudo</option>
            <option value="parcial">Recebi em parte</option>
          </Select>
        </Field>

        {received === 'parcial' && (
          <Field label="Valor recebido" htmlFor="received_amount">
            <InputWithUnit
              id="received_amount"
              name="received_amount"
              unit="R$"
              inputMode="decimal"
            />
          </Field>
        )}

        {received === 'nao' && (
          <Field label="Vencimento" htmlFor="due_date">
            <Input id="due_date" name="due_date" type="date" className="num" />
          </Field>
        )}

        {received === 'sim' && (
          <>
            {/* O servidor iguala received_amount ao total calculado da venda. */}
            <input type="hidden" name="received_full" value="on" />
            <input type="hidden" name="received_date" value={today()} />
          </>
        )}
      </FormGrid>

      <div className="mt-5">
        <Field label="Observações" htmlFor="sale_notes">
          <Textarea id="sale_notes" name="notes" />
        </Field>
      </div>
    </FormPanel>
  )
}
