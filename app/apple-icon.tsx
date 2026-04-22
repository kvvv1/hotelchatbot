import { readFile } from 'fs/promises'
import path from 'path'
import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

async function getLogoDataUrl() {
  const logoPath = path.join(process.cwd(), 'public', 'logo.png')
  const logoBuffer = await readFile(logoPath)
  return `data:image/png;base64,${logoBuffer.toString('base64')}`
}

export default async function AppleIcon() {
  const logoSrc = await getLogoDataUrl()

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        src={logoSrc}
        alt="HotelTalk"
        width="132"
        height="132"
        style={{
          objectFit: 'contain',
        }}
      />
    </div>,
    { ...size }
  )
}
