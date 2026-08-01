"use client"

import { Shield, Zap, Eye, BarChart3 } from "lucide-react"
import SectionIntro from "@/components/section-intro"

export default function Solution() {
  const features = [
    {
      title: "隐私集合运算",
      description: "各方保留自己的原始数据，只获得约定的集合结果",
      icon: Eye,
    },
    {
      title: "安全协同计算",
      description: "多个参与方共同完成计算，减少原始数据流转",
      icon: Zap,
    },
    {
      title: "多方任务管理",
      description: "统一配置参与方、运算类型和数据规模",
      icon: Shield,
    },
    {
      title: "结果与性能",
      description: "集中查看计算结果、运行时间和通信量",
      icon: BarChart3,
    },
  ]

  return (
    <section className="relative overflow-hidden bg-card/35 py-20 text-white lg:py-20">
      <div className="site-shell max-w-[2400px]">
        <SectionIntro
          eyebrow="完整流程"
          title="从多方输入到可信结果"
          mobileTitleLines={["从多方输入", "到可信结果"]}
          description="从任务配置到结果查看，清晰完成每一步集合运算。"
          hideDesktopEyebrow
          hideDesktopDescription
          className="lg:mb-10"
        />

        <div className="grid gap-5 md:grid-cols-2 lg:hidden">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div key={index} className="group rounded-lg border border-border bg-card p-8 transition-colors hover:border-accent lg:rounded-none lg:border-0 lg:border-b lg:border-border lg:bg-transparent lg:p-10 lg:nth-[odd]:border-r 2xl:border-b-0 2xl:border-r 2xl:last:border-r-0">
                <div className="flex items-center justify-between">
                  <span className="text-4xl font-bold text-primary">0{index + 1}</span>
                  <Icon className="size-7 text-muted-foreground transition-colors group-hover:text-accent" />
                </div>
                <h3 className="mb-3 mt-10 text-2xl font-bold 2xl:text-[26px]">{feature.title}</h3>
                <p className="text-lg leading-8 text-muted-foreground 2xl:text-xl 2xl:leading-9">{feature.description}</p>
              </div>
            )
          })}
        </div>

        <div className="home-card-group home-card-group-tone-cyan hidden gap-5 lg:grid 2xl:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <article key={feature.title} className="surface-card group min-h-[250px] rounded-lg p-9 text-center lg:border-primary/35">
                <Icon className="surface-card-icon mb-7 block size-10 text-primary lg:mx-auto" />
                <h3 className="mb-3 text-2xl font-bold text-foreground lg:text-[26px] 2xl:text-3xl">{feature.title}</h3>
                <p className="text-lg leading-8 text-muted-foreground lg:text-base lg:leading-7 2xl:text-lg 2xl:leading-8">{feature.description}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
