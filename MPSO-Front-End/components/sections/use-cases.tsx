"use client"

import { Briefcase, Building2, Database, DollarSign, FlaskConical, Network } from "lucide-react"
import SectionIntro from "@/components/section-intro"

export default function UseCases() {
  const useCases = [
    { icon: Building2, title: "跨机构名单匹配", description: "在不共享完整名单的情况下发现重叠对象" },
    { icon: Briefcase, title: "企业数据协作", description: "跨团队协调隐私集合工作流" },
    { icon: Database, title: "敏感数据去重", description: "以更低暴露面比较敏感记录" },
    { icon: DollarSign, title: "金融风险分析", description: "衡量多方私有集合中的共同实体" },
    { icon: FlaskConical, title: "联合统计分析", description: "计算共同样本的数量和关联数据总和" },
    { icon: Network, title: "多方性能评测", description: "评估多参与方条件下的运行表现" },
  ]

  return (
    <section className="relative overflow-hidden bg-card/35 py-20 lg:py-20">
      <div className="site-shell max-w-[2400px]">
        <SectionIntro
          eyebrow="应用方向"
          title="适用于真实的跨方数据协作"
          mobileTitleLines={["适用于真实的", "跨方数据协作"]}
          description="面向敏感集合上的隐私协作而设计。"
          hideDesktopEyebrow
          hideDesktopDescription
          className="lg:mb-10"
        />

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 lg:hidden">
          {useCases.map((useCase, index) => {
            const Icon = useCase.icon
            return (
              <div
                key={index}
                className="group flex gap-5 rounded-lg border border-border bg-card p-7 transition-colors hover:border-accent lg:rounded-none lg:border-b lg:border-l-0 lg:border-r-0 lg:bg-transparent lg:px-7 lg:py-7 lg:nth-[odd]:border-r xl:nth-[odd]:border-r-0 xl:nth-[3n+1]:border-r xl:nth-[3n+2]:border-r xl:nth-[n+4]:border-b-0"
              >
                <div className="flex size-11 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-primary transition-colors group-hover:text-accent">
                  <Icon className="size-5" />
                </div>
                <div>
                  <h3 className="mb-2 text-2xl font-bold text-foreground 2xl:text-[26px]">{useCase.title}</h3>
                  <p className="text-lg leading-8 text-muted-foreground 2xl:text-xl 2xl:leading-9">{useCase.description}</p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="home-card-group home-card-group-tone-cyan hidden gap-5 lg:grid xl:grid-cols-3">
          {useCases.map((useCase) => {
            const Icon = useCase.icon
            return (
              <article key={useCase.title} className="surface-card group min-h-[230px] rounded-lg p-9 text-center lg:border-primary/35">
                <Icon className="surface-card-icon mb-7 block size-10 text-primary lg:mx-auto" />
                <h3 className="mb-3 text-2xl font-bold text-foreground lg:text-[26px] 2xl:text-3xl">{useCase.title}</h3>
                <p className="text-lg leading-8 text-muted-foreground lg:text-base lg:leading-7 2xl:text-lg 2xl:leading-8">{useCase.description}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
