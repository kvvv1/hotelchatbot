import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HotelTalk',
    short_name: 'HotelTalk',
    description: 'Sistema de IA, atendimento e gestao hoteleira',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#7c3aed',
    orientation: 'portrait',
    categories: ['productivity', 'business'],
    icons: [
      {
        src: '/icon?v=2',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/apple-icon?v=2',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
