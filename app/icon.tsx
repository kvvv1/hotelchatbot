import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '96px',
      }}
    >
      <span
        style={{
          color: 'white',
          fontSize: '300px',
          fontWeight: 800,
          fontFamily: 'sans-serif',
          lineHeight: 1,
        }}
      >
        H
      </span>
    </div>,
    { ...size }
  )
}
