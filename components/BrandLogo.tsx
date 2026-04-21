import Image from 'next/image'

interface BrandLogoProps {
  className?: string
  priority?: boolean
  variant?: 'full' | 'mark'
}

export function BrandLogo({ className = '', priority = false, variant = 'full' }: BrandLogoProps) {
  const imageClassName =
    variant === 'mark'
      ? 'h-full w-full object-contain drop-shadow-[0_10px_22px_rgba(124,58,237,0.28)]'
      : 'h-full w-full object-contain'

  return (
    <div className={className}>
      <Image
        src="/logo.png"
        alt="HotelTalk"
        width={300}
        height={300}
        priority={priority}
        sizes="(max-width: 768px) 64px, 96px"
        className={imageClassName}
      />
    </div>
  )
}
