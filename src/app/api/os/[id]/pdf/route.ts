import { NextResponse } from 'next/server'
import { getFarmContext } from '@/lib/farm'
import { getServiceOrderDetail } from '@/lib/queries/orders'
import { buildServiceOrderPdf } from '@/lib/pdf/service-order'
import { orderFileName } from '@/lib/orders'

/**
 * PDF da ordem de servico. Mesma sessao e mesmo RLS das telas: so' sai
 * a OS da propriedade ativa de quem esta logado.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'OS inválida' }, { status: 400 })

  const ctx = await getFarmContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const os = await getServiceOrderDetail(id, ctx.farm.id)
  if (!os) return NextResponse.json({ error: 'OS não encontrada' }, { status: 404 })

  const bytes = await buildServiceOrderPdf(os)
  const name = orderFileName(os.number, os.kind, os.plot?.code ?? os.machine?.name)
  // ?baixar=1 forca o download; sem ele o navegador abre o PDF (para imprimir).
  const download = new URL(request.url).searchParams.get('baixar') === '1'

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
