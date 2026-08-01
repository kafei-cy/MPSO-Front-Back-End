"use client"

import { AlertTriangle, GitBranch, Zap } from "lucide-react"
import SectionIntro from "@/components/section-intro"

export default function Problem() {
  const problems = [
    {
      stat: "原始数据不能直接汇总",
      description: "跨机构协作需要共同结果，但敏感数据不能离开各方控制范围",
      icon: GitBranch,
    },
    {
      stat: "明文比对容易泄露信息",
      description: "直接交换名单或标识，会让无关数据一并暴露",
      icon: AlertTriangle,
    },
    {
      stat: "多方协作难以统一管理",
      description: "参与方、数据规模和运算流程需要清晰配置并统一执行",
      icon: Zap,
    },
  ]

  return (
    <section className="relative overflow-hidden bg-background py-20 lg:pb-20 lg:pt-10">
      <div className="site-shell max-w-[2400px]">
        <SectionIntro
          eyebrow="协作挑战"
          title="多方数据为什么难以直接协作"
          mobileTitleLines={["多方数据为什么", "难以直接协作"]}
          description="在不交换完整数据的前提下，让多个参与方获得可信、可用的集合运算结果。"
          hideDesktopEyebrow
          hideDesktopDescription
          className="lg:mb-10"
        />

        <div className="home-card-group home-card-group-tone-green grid gap-5 md:grid-cols-3">
          {problems.map((problem, index) => {
            const Icon = problem.icon
            return (
              <div
                key={index}
                className="surface-card group rounded-lg p-7 lg:border-primary/35 lg:p-9 lg:text-center"
              >
                <Icon className="surface-card-icon mb-7 block size-8 text-primary lg:mx-auto" />
                <h3 className="mb-3 text-2xl font-bold text-foreground lg:text-[26px] 2xl:text-3xl">{problem.stat}</h3>
                <p className="text-lg leading-8 text-muted-foreground lg:text-base lg:leading-7 2xl:text-lg 2xl:leading-8">{problem.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
