/**
 * Paisagem do campo em traco de uma cor so' (currentColor): horizonte,
 * morros, sol e as linhas do parreiral em perspectiva, com os postes e o
 * arame da latada. Segue o tema — preto no claro, branco no escuro.
 */
const VP = { x: 200, y: 330 } // ponto de fuga, na linha do horizonte
const ROWS = Array.from({ length: 15 }, (_, i) => i - 7)
const STEPS = [0.08, 0.18, 0.32, 0.5, 0.74, 1] // postes ao longo de cada linha

function rowPoint(i: number, t: number) {
  const x0 = VP.x + i * 6
  const x1 = VP.x + i * 95
  return { x: x0 + (x1 - x0) * t, y: VP.y + 2 + (600 - VP.y - 2) * t }
}

export function FieldScene({ className = '', showSky = true }: { className?: string; showSky?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 600"
      preserveAspectRatio="xMidYMax slice"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
    >
      {showSky && (
        <>
          {/* sol */}
          <circle cx="308" cy="178" r="30" strokeWidth="1.2" />
          <circle cx="308" cy="178" r="44" strokeWidth="0.6" strokeDasharray="2 6" />
          {/* passaros */}
          <path d="M92 150 q6 -6 12 0 q6 -6 12 0" strokeWidth="1" />
          <path d="M126 128 q4 -4 8 0 q4 -4 8 0" strokeWidth="0.9" />
        </>
      )}

      {/* morros ao fundo */}
      <path d="M0 318 Q 70 272 150 300 T 290 292 T 400 286" strokeWidth="1" />
      <path d="M0 330 Q 110 300 210 322 T 400 312" strokeWidth="1.2" />
      <line x1="0" y1={VP.y} x2="400" y2={VP.y} strokeWidth="0.8" />

      {/* linhas do parreiral */}
      {ROWS.map((i) => {
        const a = rowPoint(i, 0)
        const b = rowPoint(i, 1)
        return <line key={`r${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth="0.9" />
      })}

      {/* arame da latada entre as linhas */}
      {STEPS.map((t) => {
        const a = rowPoint(ROWS[0], t)
        const b = rowPoint(ROWS[ROWS.length - 1], t)
        return <line key={`w${t}`} x1={a.x} y1={a.y - 16 * t} x2={b.x} y2={b.y - 16 * t} strokeWidth={0.4 + 0.6 * t} />
      })}

      {/* postes: crescem com a proximidade */}
      {ROWS.map((i) =>
        STEPS.map((t) => {
          const p = rowPoint(i, t)
          return <line key={`p${i}-${t}`} x1={p.x} y1={p.y} x2={p.x} y2={p.y - 18 * t} strokeWidth={0.5 + 1.1 * t} />
        }),
      )}
    </svg>
  )
}
