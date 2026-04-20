import Image from 'next/image'

interface BrandLogoProps {
  className?: string
  priority?: boolean
  variant?: 'full' | 'icon'
}

export function BrandLogo({ className = '', priority = false, variant = 'full' }: BrandLogoProps) {
  const frameClassName =
    variant === 'icon'
      ? 'relative h-full w-full overflow-hidden rounded-[inherit]'
      : 'relative h-full w-full overflow-hidden'

  const imageClassName =
    variant === 'icon'
      ? 'h-full w-full object-contain scale-[2.05] -translate-y-[18%] drop-shadow-[0_10px_22px_rgba(124,58,237,0.35)]'
      : 'h-full w-full object-contain scale-[1.58] translate-y-[2%] drop-shadow-[0_14px_32px_rgba(124,58,237,0.24)]'

  return (
    <div className={className}>
      <div className={frameClassName}>
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
    </div>
  )
}
