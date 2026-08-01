'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Blend, ChevronDown, Combine, Hash, KeyRound, Sigma } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Footer from '@/components/sections/footer'

const featureDetails = [
  {
    id: 'intersection',
    icon: Blend,
    title: '隐私集合求交集',
    summary: '在不暴露完整私有集合的情况下，计算多方数据之间的共同元素。',
    result: '共同元素集合',
    scene: '多方数据对齐、名单匹配、联合风控等场景。',
    image: '/cyphero-infographics/cyphero-multi-party-psi-intersection.svg',
    alt: '隐私集合求交集功能示意图',
    points: ['多方分别持有自己的集合', '无需交换完整数据即可完成匹配', '结果仅包含各方共同拥有的元素'],
  },
  {
    id: 'union',
    icon: Combine,
    title: '隐私集合求并集',
    summary: '在保护各方原始输入的前提下，完成多方集合的联合计算。',
    result: '联合元素集合',
    scene: '跨机构样本汇总、重复数据控制、协同统计等场景。',
    image: '/cyphero-infographics/cyphero-multi-party-psi-union.svg',
    alt: '隐私集合求并集功能示意图',
    points: ['汇总多方集合中出现过的元素', '自动合并重复项', '各方无需互相交换完整列表'],
  },
  {
    id: 'intersection-count',
    icon: Hash,
    title: '隐私集合求交集数量',
    summary: '只输出交集规模，不暴露交集中的具体元素，适合统计类协作场景。',
    result: '交集数量',
    scene: '共同用户规模评估、联合样本覆盖率、协作前置评估等场景。',
    image: '/cyphero-infographics/cyphero-multi-party-psi-intersection-count.svg',
    alt: '隐私集合求交集数量功能示意图',
    points: ['不返回具体共同元素', '只输出交集中的元素数量', '适合先判断共同数据规模'],
  },
  {
    id: 'intersection-sum',
    icon: Sigma,
    title: '隐私集合求交集的和',
    summary: '在交集范围内对关联数值求和，支持隐私保护的数据聚合分析。',
    result: '交集关联值之和',
    scene: '联合指标统计、共同样本金额汇总、隐私保护聚合分析等场景。',
    image: '/cyphero-infographics/cyphero-multi-party-psi-intersection-sum.svg',
    alt: '隐私集合求交集的和功能示意图',
    points: ['先确定各方的共同元素', '再汇总共同元素对应的数值', '只输出总和，不显示各方明细'],
  },
  {
    id: 'private-id',
    icon: KeyRound,
    title: '隐私标识对齐（Private-ID）',
    summary: '在不泄露邮箱、手机号等原始标识的情况下，为跨方匹配记录生成统一标识。',
    result: '统一隐私标识',
    scene: '跨机构用户对齐、联合分析前的数据关联、广告归因与协同建模等场景。',
    image: '/cyphero-infographics/cyphero-private-id-alignment.svg',
    alt: 'Private-ID 隐私标识对齐功能示意图',
    points: ['相同对象生成一致的隐私标识', '未匹配记录不会暴露给其他参与方', '便于后续开展跨方联合计算'],
  },
]

export default function FeatureDetails() {
  const [openIndex, setOpenIndex] = useState(0)

  useEffect(() => {
    const targetId = window.location.hash.slice(1)
    const targetIndex = featureDetails.findIndex((feature) => feature.id === targetId)
    if (targetIndex >= 0) {
      setOpenIndex(targetIndex)
      const scrollTimer = window.setTimeout(() => {
        const target = document.getElementById(targetId)
        if (!target) return
        const top = target.getBoundingClientRect().top + window.scrollY - 112
        window.scrollTo({ top: Math.max(0, top), behavior: 'auto' })
      }, 0)
      return () => window.clearTimeout(scrollTimer)
    }
  }, [])

  return (
    <main className="overflow-hidden bg-background text-foreground">
      <section className="pb-8 pt-32 lg:pb-10 lg:pt-36 2xl:pt-40">
        <div className="site-shell max-w-[1800px] text-center">
          <h1 className="text-5xl font-bold leading-tight md:text-6xl 2xl:text-[68px]">
            功能<span className="text-accent">详情</span>
          </h1>
          <p className="mx-auto mt-5 max-w-[900px] text-lg leading-8 text-muted-foreground lg:text-xl">
            围绕多方隐私集合运算的五项核心功能，展示输入、计算和输出结果。
          </p>
        </div>
      </section>

      <section className="bg-background pb-16 pt-5 lg:pb-20 lg:pt-6">
        <div className="site-shell max-w-[1800px]">
          <div className="space-y-4">
            {featureDetails.map((feature, index) => {
              const Icon = feature.icon
              const isOpen = openIndex === index

              return (
                <article
                  id={feature.id}
                  key={feature.title}
                  className="surface-card scroll-mt-28 overflow-hidden rounded-lg lg:border-primary/35"
                >
                  <button
                    type="button"
                    className={`flex w-full cursor-pointer items-center justify-between gap-5 px-6 py-5 transition-colors md:px-8 ${isOpen ? 'bg-secondary/45' : 'hover:bg-secondary/30'}`}
                    onClick={() => setOpenIndex(isOpen ? -1 : index)}
                    aria-expanded={isOpen}
                  >
                    <div className="flex min-w-0 items-center gap-4 text-left">
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <Icon className="size-6" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-xl font-bold text-foreground md:text-2xl">{feature.title}</h2>
                        <p className="mt-1 hidden text-base leading-7 text-muted-foreground sm:block">{feature.summary}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="hidden rounded-full border border-accent/35 bg-accent/5 px-3 py-1.5 text-sm text-accent md:inline-flex">
                        {feature.result}
                      </span>
                      <ChevronDown
                        className={`size-5 text-primary transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-border bg-background p-6 md:p-7 lg:p-8">
                      <div className="grid items-center gap-8 lg:grid-cols-[minmax(320px,0.7fr)_minmax(0,1.3fr)]">
                        <div className="space-y-6">
                          <div>
                            <p className="mb-2 text-sm text-muted-foreground">输出结果</p>
                            <p className="text-2xl font-bold text-primary 2xl:text-3xl">{feature.result}</p>
                          </div>

                          <div>
                            <p className="mb-2 text-sm text-muted-foreground">适用场景</p>
                            <p className="text-base leading-7 text-foreground/90 2xl:text-lg">{feature.scene}</p>
                          </div>

                          <div className="space-y-3 border-t border-primary/15 pt-5">
                            {feature.points.map((point) => (
                              <div key={point} className="flex items-start gap-3 text-base leading-7 text-foreground/90">
                                <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent"></span>
                                <span>{point}</span>
                              </div>
                            ))}
                          </div>

                          <Link href="/contact" className="inline-flex">
                            <Button className="h-11 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/85">
                              前往运行面板
                              <ArrowRight className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>

                        <figure className="overflow-hidden rounded-lg border border-border bg-card/35 p-3">
                          <img
                            src={feature.image}
                            alt={feature.alt}
                            className="aspect-[3/2] w-full rounded-md object-contain"
                          />
                        </figure>
                      </div>
                    </div>
                  )}
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
