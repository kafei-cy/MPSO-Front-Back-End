import { cn } from '@/lib/utils'

type SectionIntroProps = {
  eyebrow: string
  title: string
  mobileTitleLines?: readonly [string, string]
  description?: string
  hideDesktopEyebrow?: boolean
  hideDesktopDescription?: boolean
  className?: string
}

export default function SectionIntro({
  eyebrow,
  title,
  mobileTitleLines,
  description,
  hideDesktopEyebrow = false,
  hideDesktopDescription = false,
  className,
}: SectionIntroProps) {
  return (
    <div className={cn('mb-12 max-w-[1600px] lg:mx-auto lg:mb-14 lg:max-w-[1120px]', className)}>
      <div className="lg:hidden">
        <p className="section-kicker mb-4">{eyebrow}</p>
        <h2 className="balanced-heading text-3xl font-bold leading-[1.16] text-foreground md:text-5xl">
          {mobileTitleLines ? (
            <span>
              <span className="block">{mobileTitleLines[0]}</span>
              <span className="block">{mobileTitleLines[1]}</span>
            </span>
          ) : title}
        </h2>
        {description ? (
          <p className="mt-5 max-w-[1080px] text-lg leading-8 text-muted-foreground md:text-xl md:leading-9">
            {description}
          </p>
        ) : null}
      </div>

      <div className="hidden space-y-4 text-center lg:block">
        <p className={cn('section-kicker text-base 2xl:text-lg', hideDesktopEyebrow && 'hidden')}>{eyebrow}</p>
        <h2 className="balanced-heading text-5xl font-bold leading-[1.16] text-foreground 2xl:text-[56px]">{title}</h2>
        {description ? (
          <p className={cn('mx-auto max-w-[960px] text-lg leading-8 text-muted-foreground 2xl:text-xl 2xl:leading-9', hideDesktopDescription && 'hidden')}>
            {description}
          </p>
        ) : null}
      </div>
    </div>
  )
}
