import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  experimental: {
    // O disco deste projeto e' lento para I/O pequeno e frequente (comum
    // com antivirus escaneando cada escrita no Windows). O cache
    // persistente do Turbopack em .next/dev/cache faz uma "compactacao"
    // periodica que, nesse tipo de disco, trava o servidor por minutos
    // (visto: "Finished filesystem cache database compaction in 3.8min").
    // Desligar troca "builds incrementais mais rapidos entre reinicios"
    // por "sem congelamentos" — no fs lento, o cache custa mais do que
    // economiza. Reavalie se o projeto for movido para um disco rapido
    // sem antivirus no caminho.
    turbopackFileSystemCacheForDev: false,
    turbopackFileSystemCacheForBuild: false,
    // O barril do Phosphor reexporta 1.513 icones, cada um num arquivo.
    // Sem isto, qualquer pagina que importa um icone faz o compilador
    // resolver os 1.513 modulos — no disco lento, dezenas de segundos.
    // O pacote nao esta na lista otimizada por padrao do Next.
    optimizePackageImports: ['@phosphor-icons/react', '@phosphor-icons/react/dist/ssr'],
  },
  // "Aplicacoes" virou "Pulverizacao": links e favoritos antigos continuam valendo.
  async redirects() {
    return [{ source: '/aplicacoes', destination: '/pulverizacao', permanent: true }]
  },
  // Cabecalhos de seguranca. CSP fica fora daqui porque o Next injeta
  // scripts inline com nonce por requisicao — ver src/proxy.ts.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}

export default nextConfig
