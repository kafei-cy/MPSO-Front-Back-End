import Link from 'next/link'
import { ArrowRight, Blend, Combine, Hash, KeyRound, Sigma } from 'lucide-react'
import Footer from '@/components/sections/footer'

const services = [
  {
    slug: 'intersection',
    code: 'MPSI',
    icon: Blend,
    title: '隐私集合求交',
    description: '在不暴露完整私有集合的情况下，计算多方数据之间的共同元素。',
    features: ['多方输入', '安全匹配', '交集输出', '结果核验'],
  },
  {
    slug: 'union',
    code: 'MPSU',
    icon: Combine,
    title: '隐私集合求并',
    description: '在保护各方原始输入的前提下，完成多方集合的联合计算。',
    features: ['集合聚合', '多方协同', '重复项处理', '并集输出'],
  },
  {
    slug: 'intersection-count',
    code: 'MPSI-CA',
    icon: Hash,
    title: '隐私交集数量',
    description: '只输出交集规模，不暴露交集中的具体元素，适合统计类协作场景。',
    features: ['基数统计', '隐私计数', '结果校验', '运行摘要'],
  },
  {
    slug: 'intersection-sum',
    code: 'MPSI-SUM',
    icon: Sigma,
    title: '隐私交集求和',
    description: '在交集范围内对关联数值求和，支持隐私保护的数据聚合分析。',
    features: ['交集过滤', '数值聚合', '和值输出', '结果访问'],
  },
  {
    slug: 'private-id',
    code: 'PRIVATE-ID',
    icon: KeyRound,
    title: '隐私标识对齐',
    description: '在不暴露原始标识的情况下，为跨方匹配记录生成统一标识。',
    features: ['跨方记录匹配', '原始标识保护', '统一 ID 映射', '多方数据对齐'],
  },
]

export default function Services() {
  return (
    <main className="overflow-hidden bg-background text-foreground">
      <section className="pb-6 pt-32 lg:pt-36 2xl:pt-40">
        <div className="site-shell max-w-[2400px] text-center">
          <h1 className="text-5xl font-bold leading-tight md:text-6xl 2xl:text-[68px]">
            功能<span className="text-accent">服务</span>
          </h1>
          <p className="mx-auto mt-5 max-w-[820px] text-lg leading-8 text-muted-foreground lg:text-xl">
            覆盖隐私集合求交、求并、统计、求和与标识对齐。
          </p>
        </div>
      </section>

      <section className="pb-16 pt-4 lg:pt-5">
        <div className="site-shell max-w-[2400px]">
          <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-6">
            {services.map((service, index) => {
              const Icon = service.icon
              const wideScreenPosition = index === 3
                ? '2xl:col-start-2'
                : index === 4
                  ? '2xl:col-start-4'
                  : ''

              return (
                <article
                  key={service.title}
                  className={`surface-card group flex min-h-[320px] flex-col rounded-lg p-7 2xl:col-span-2 2xl:p-8 ${wideScreenPosition}`}
                >
                  <div className="flex items-start gap-4">
                    <Icon className="surface-card-icon mt-0.5 size-8 shrink-0 text-primary" />
                    <h2 className="min-w-0 text-2xl font-bold leading-snug text-foreground">{service.title}</h2>
                    <span className="ml-auto shrink-0 rounded border border-primary/25 bg-primary/5 px-2 py-1 font-mono text-xs font-semibold text-primary/90">
                      {service.code}
                    </span>
                  </div>

                  <p className="mt-5 text-base leading-7 text-muted-foreground 2xl:text-[17px]">{service.description}</p>

                  <div className="mt-7 grid grid-cols-2 gap-x-5 gap-y-3">
                    {service.features.map((feature) => (
                      <span key={feature} className="inline-flex items-center gap-2.5 text-base text-foreground/80">
                        <span className="size-1.5 shrink-0 rounded-full bg-accent"></span>
                        {feature}
                      </span>
                    ))}
                  </div>

                  <Link
                    href={`/feature-details#${service.slug}`}
                    className="mt-auto inline-flex w-fit items-center gap-2 pt-8 text-base font-bold text-primary transition-colors hover:text-accent"
                  >
                    查看功能详情
                    <ArrowRight className="size-4" />
                  </Link>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
