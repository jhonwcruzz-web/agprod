import type { Route } from 'next'
import {
  BarnIcon,
  ChartLineUpIcon,
  CoinsIcon,
  DropIcon,
  GasPumpIcon,
  GridFourIcon,
  HandCoinsIcon,
  HouseIcon,
  LeafIcon,
  PackageIcon,
  PlantIcon,
  ReceiptIcon,
  SparkleIcon,
  TestTubeIcon,
  TractorIcon,
  WrenchIcon,
} from '@phosphor-icons/react/dist/ssr'
import type { Icon } from '@phosphor-icons/react'
import { FEATURES } from '@/lib/config'

export type NavItem = {
  href: Route
  label: string
  icon: Icon
  /** Agrupamento visual da sidebar. */
  group: 'painel' | 'campo' | 'dinheiro'
}

const ALL_NAV: NavItem[] = [
  { href: '/', label: 'Início', icon: HouseIcon, group: 'painel' },
  { href: '/fazenda', label: 'Fazenda', icon: BarnIcon, group: 'painel' },
  { href: '/talhoes', label: 'Talhões', icon: GridFourIcon, group: 'painel' },
  { href: '/maquinas', label: 'Máquinas', icon: TractorIcon, group: 'painel' },

  { href: '/producao', label: 'Produção', icon: PlantIcon, group: 'campo' },
  { href: '/pulverizacao', label: 'Pulverização', icon: TestTubeIcon, group: 'campo' },
  { href: '/adubacao', label: 'Adubação', icon: LeafIcon, group: 'campo' },
  { href: '/irrigacao', label: 'Irrigação', icon: DropIcon, group: 'campo' },
  { href: '/estoque', label: 'Estoque', icon: PackageIcon, group: 'campo' },

  { href: '/custos', label: 'Custos', icon: ReceiptIcon, group: 'dinheiro' },
  { href: '/comercializacao', label: 'Comercialização', icon: HandCoinsIcon, group: 'dinheiro' },
  { href: '/financeiro', label: 'Financeiro', icon: CoinsIcon, group: 'dinheiro' },
  { href: '/safras', label: 'Safras', icon: ChartLineUpIcon, group: 'dinheiro' },
]

/** Itens visiveis: recursos desligados em FEATURES somem do menu. */
export const NAV: NavItem[] = ALL_NAV.filter(
  (n) => FEATURES.irrigation || n.href !== '/irrigacao',
)

export const GROUP_LABEL: Record<NavItem['group'], string> = {
  painel: 'Propriedade',
  campo: 'Campo',
  dinheiro: 'Resultado',
}

export const AI_ITEM = {
  href: '/assistente' as Route,
  label: 'Perguntar sobre minha fazenda',
  icon: SparkleIcon,
}

/** Atalhos do botao "+ Registrar" (secoes 41 e 42). */
const ALL_QUICK_ACTIONS = [
  { key: 'producao', label: 'Colheita', href: '/producao?novo=1' as Route, icon: PlantIcon },
  { key: 'aplicacao', label: 'Pulverização', href: '/pulverizacao?novo=1' as Route, icon: TestTubeIcon },
  { key: 'adubacao', label: 'Adubação', href: '/adubacao?novo=1' as Route, icon: LeafIcon },
  { key: 'irrigacao', label: 'Irrigação', href: '/irrigacao?novo=1' as Route, icon: DropIcon },
  { key: 'venda', label: 'Venda', href: '/comercializacao?novo=1' as Route, icon: HandCoinsIcon },
  { key: 'despesa', label: 'Despesa', href: '/custos?novo=1' as Route, icon: ReceiptIcon },
  { key: 'compra', label: 'Compra / Estoque', href: '/estoque?novo=1' as Route, icon: PackageIcon },
  { key: 'manutencao', label: 'Manutenção', href: '/maquinas?registro=1' as Route, icon: WrenchIcon },
  { key: 'abastecimento', label: 'Abastecimento', href: '/maquinas?registro=1&tipo=abastecimento' as Route, icon: GasPumpIcon },
] as const

export const QUICK_ACTIONS = ALL_QUICK_ACTIONS.filter(
  (a) => FEATURES.irrigation || a.key !== 'irrigacao',
)
