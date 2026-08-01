type PageIntroProps = {
  eyebrow: string
  title: string
  mobileTitleLines?: readonly [string, string]
  description: string
}

export default function PageIntro({ eyebrow, title, mobileTitleLines, description }: PageIntroProps) {
  return (
    <section className="bg-background pb-12 pt-32 lg:pb-16 lg:pt-36 2xl:pb-20 2xl:pt-40">
      <div className="site-shell max-w-[2400px]">
        <div className="max-w-[1800px] text-left lg:mx-auto lg:max-w-[1280px] lg:text-center">
          <p className="section-kicker mb-5">{eyebrow}</p>
          <h1 className="balanced-heading text-4xl font-bold leading-[1.12] text-foreground md:text-6xl lg:text-6xl 2xl:text-[68px]">
            {mobileTitleLines ? (
              <>
                <span className="hidden lg:inline">{title}</span>
                <span className="lg:hidden">
                  <span className="block">{mobileTitleLines[0]}</span>
                  <span className="block">{mobileTitleLines[1]}</span>
                </span>
              </>
            ) : title}
          </h1>
          <p className="mt-7 max-w-[1600px] text-lg leading-8 text-muted-foreground md:text-2xl md:leading-10 lg:mx-auto lg:mt-6 lg:max-w-[1040px] lg:text-xl lg:leading-9 2xl:text-[22px] 2xl:leading-10">
            {description}
          </p>
        </div>
      </div>
    </section>
  )
}
