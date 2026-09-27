import { ImageResponse } from 'next/og'

/** Icone da tela inicial do iPhone: mesma marca do favicon, em PNG. */
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  const bar = (height: number, color: string) => (
    <div style={{ width: 22, height, borderRadius: 11, background: color }} />
  )
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: 18,
          paddingBottom: 44,
          background: '#2f4d36',
        }}
      >
        {bar(38, '#ffffff')}
        {bar(70, '#ffffff')}
        {bar(100, '#c0d5c2')}
      </div>
    ),
    size,
  )
}
