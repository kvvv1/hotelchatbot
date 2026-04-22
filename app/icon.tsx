import { readFile } from 'fs/promises'
import path from 'path'
import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

async function getLogoDataUrl() {
  const logoPath = path.join(process.cwd(), 'public', 'logo.png')
  const logoBuffer = await readFile(logoPath)
  return `data:image/png;base64,${logoBuffer.toString('base64')}`
}

export default async function Icon() {
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
        borderRadius: '112px',
      }}
    >
      <img
        src={logoSrc}
        alt="HotelTalk"
        width="380"
        height="380"
        style={{
          objectFit: 'contain',
        }}
      />
    </div>,
    { ...size }
  )
}
