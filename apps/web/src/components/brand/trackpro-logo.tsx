import { MapPin } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const SIZES = {
  sm: {
    box: 'w-8 h-8 rounded-lg',
    icon: 'w-4 h-4',
    title: 'text-sm font-bold',
    subtitle: 'text-xs',
    gap: 'gap-2.5',
  },
  md: {
    box: 'w-10 h-10 rounded-xl',
    icon: 'w-5 h-5',
    title: 'text-xl font-bold',
    subtitle: 'text-xs',
    gap: 'gap-2.5',
  },
  lg: {
    box: 'w-11 h-11 md:w-12 md:h-12 rounded-xl',
    icon: 'w-6 h-6 md:w-7 md:h-7',
    title: 'text-2xl md:text-3xl font-bold',
    subtitle: 'text-xs',
    gap: 'gap-3',
  },
} as const

interface TrackProLogoProps {
  size?: keyof typeof SIZES
  subtitle?: string
  className?: string
  iconOnly?: boolean
  /** dark = fondos oscuros; light = fondos claros */
  theme?: 'dark' | 'light'
}

export function TrackProLogo({
  size = 'md',
  subtitle,
  className,
  iconOnly = false,
  theme = 'dark',
}: TrackProLogoProps) {
  const s = SIZES[size]
  const isDark = theme === 'dark'

  return (
    <div className={cn('flex items-center min-w-0', s.gap, className)}>
      <div
        className={cn(
          s.box,
          'flex items-center justify-center flex-shrink-0',
          isDark
            ? 'bg-orange-500/20 border border-orange-400/40'
            : 'bg-orange-50 border border-orange-200',
          size === 'lg' && isDark && 'shadow-lg',
        )}
      >
        <MapPin
          className={cn(s.icon, isDark ? 'text-orange-400' : 'text-orange-500')}
          strokeWidth={2.25}
        />
      </div>
      {!iconOnly && (
        <div className="min-w-0">
          <div
            className={cn(
              s.title,
              'tracking-tight truncate',
              isDark ? 'text-white' : 'text-gray-900',
            )}
          >
            TrackPro <span className="text-orange-400">GPS</span>
          </div>
          {subtitle && (
            <div className={cn(s.subtitle, 'truncate', isDark ? 'text-gray-400' : 'text-gray-500')}>
              {subtitle}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
