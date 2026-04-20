import Image from 'next/image'

interface BrandLogoProps {
  className?: string
  priority?: boolean
  variant?: 'full' | 'icon'
}

export function BrandLogo({ className = '', priority = false, variant = 'full' }: BrandLogoProps) {
  const imageClassName =
    variant === 'icon'
      ? 'h-full w-full rounded-[inherit] object-cover object-top'
      : 'h-full w-full object-contain'

  return (
    <div className={className}>
      <Image
        src="/logo.png"
        alt="HotelTalk"
        width={1024}
        height={1024}
        priority={priority}
        sizes="(max-width: 768px) 80px, 120px"
        className={imageClassName}
      />
    </div>
  )
}
