"use client"

import { Search, Cpu, Lock, BarChart3, Users } from "lucide-react"
import SectionIntro from "@/components/section-intro"

export default function Features() {
  const features = [
    {
      icon: Search,
      title: "多方任务配置",
      description: "设置参与方数量、运算类型和数据规模",
    },
    {
      icon: Cpu,
      title: "集合运算",
      description: "支持求交、求并、数量统计和数据求和",
    },
    {
      icon: Lock,
      title: "输入数据保护",
      description: "原始集合由各参与方分别保管",
    },
    {
      icon: BarChart3,
      title: "性能看板",
      description: "跟踪任务进度、运行时间和当前状态",
    },
    {
      icon: Lock,
      title: "结果查看",
      description: "集中查看集合结果和统计信息",
    },
    {
      icon: Users,
      title: "性能对比",
      description: "直观比较不同规模下的耗时和通信量",
    },
  ]

  return (
    <section className="relative overflow-hidden bg-background py-20 lg:py-20">
      <div className="site-shell max-w-[2400px]">
        <SectionIntro
          eyebrow="平台能力"
          title="覆盖运算全流程的核心能力"
          mobileTitleLines={["覆盖运算全流程", "的核心能力"]}
          description="覆盖多方隐私集合运算的配置、执行与结果分析。"
          hideDesktopEyebrow
          hideDesktopDescription
          className="lg:mb-10"
        />

        <div className="home-card-group home-card-group-tone-green grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div key={index} className="surface-card group rounded-lg p-8 lg:border-primary/35 lg:p-9 lg:text-center">
                <Icon className="surface-card-icon mb-7 block size-10 text-primary lg:mx-auto" />
                <h3 className="mb-3 text-2xl font-bold text-foreground lg:text-[26px] 2xl:text-3xl">{feature.title}</h3>
                <p className="text-lg leading-8 text-muted-foreground lg:text-base lg:leading-7 2xl:text-lg 2xl:leading-8">{feature.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
