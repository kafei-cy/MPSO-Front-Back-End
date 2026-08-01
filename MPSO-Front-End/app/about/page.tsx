import { Fragment } from 'react'
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Database,
  LockKeyhole,
  Shield,
  Users,
  Zap,
} from 'lucide-react'
import Footer from '@/components/sections/footer'

const stats = [
  { label: '核心功能', value: '5' },
  { label: '多方模式', value: 'N' },
  { label: '运算流程', value: '5' },
  { label: '聚焦方向', value: '隐私集合运算' },
]

const principles = [
  {
    icon: Shield,
    title: '隐私优先',
    description: '原始私有集合始终保留在参与方控制范围内。',
  },
  {
    icon: Users,
    title: '面向展示',
    description: '用直观流程呈现参与方、通信过程和运算结果。',
  },
  {
    icon: Award,
    title: '协议清晰',
    description: '清楚展示运算类型、运行进度和最终结果。',
  },
  {
    icon: Zap,
    title: '研究驱动',
    description: '围绕多方隐私集合运算的实验与评测持续完善。',
  },
]

const workflow = [
  {
    icon: Database,
    step: '01',
    title: '本地数据',
    description: '原始集合保留在参与方本地',
  },
  {
    icon: LockKeyhole,
    step: '02',
    title: '安全计算',
    description: '参与方之间仅交换协议消息',
  },
  {
    icon: CheckCircle2,
    step: '03',
    title: '约定结果',
    description: '按照任务类型返回计算结果',
  },
]

function FlowConnector() {
  return (
    <div className="about-flow-connector" aria-hidden="true">
      <span className="about-flow-track"></span>
      <span className="about-flow-packet"></span>
      <ArrowRight className="about-flow-arrow" />
    </div>
  )
}

export default function About() {
  return (
    <main className="overflow-hidden bg-background text-foreground">
      <section className="pb-6 pt-32 lg:pt-36 2xl:pt-40">
        <div className="site-shell max-w-[2400px] text-center">
          <h1 className="text-5xl font-bold leading-tight md:text-6xl 2xl:text-[68px]">
            关于 <span className="text-accent">CypherO</span>
          </h1>
          <p className="mx-auto mt-5 max-w-[760px] text-lg leading-8 text-muted-foreground lg:text-xl">
            面向多方隐私集合运算的专用展示平台。
          </p>
        </div>
      </section>

      <section className="pb-12 pt-4 lg:pb-14 lg:pt-5">
        <div className="site-shell max-w-[2400px]">
          <div className="mx-auto max-w-[1120px] text-center">
            <h2 className="text-3xl font-bold text-foreground md:text-4xl 2xl:text-[44px]">我们的目标</h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground 2xl:text-xl 2xl:leading-9">
              让隐私集合计算更容易展示、测试和解释，将多方集合运算转化为清晰、直观的操作流程。
            </p>
          </div>

          <article className="surface-card about-card-tone-green group mx-auto mt-10 max-w-[1800px] rounded-lg p-7 lg:p-9 2xl:p-10">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(90px,0.22fr)_minmax(0,1fr)_minmax(90px,0.22fr)_minmax(0,1fr)] lg:items-center">
              {workflow.map((stage, index) => {
                const Icon = stage.icon
                return (
                  <Fragment key={stage.title}>
                    <div className="relative flex min-h-[125px] flex-col items-center justify-center px-5 text-center">
                      <span className="about-card-accent absolute right-3 top-1 font-mono text-sm font-bold">{stage.step}</span>
                      <div className="flex items-center gap-3">
                        <Icon className="surface-card-icon size-8" />
                        <h3 className="text-xl font-bold text-foreground 2xl:text-2xl">{stage.title}</h3>
                      </div>
                      <p className="mt-3 text-base leading-7 text-muted-foreground 2xl:text-lg">{stage.description}</p>
                    </div>
                    {index < workflow.length - 1 ? <FlowConnector /> : null}
                  </Fragment>
                )
              })}
            </div>

            <div className="mt-7 grid border-t border-border/70 pt-7 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="border-border/70 px-5 py-3 text-center sm:nth-[even]:border-l lg:border-l lg:first:border-l-0">
                  <p className="about-card-accent text-4xl font-bold 2xl:text-[42px]">{stat.value}</p>
                  <p className="mt-3 text-base font-medium text-muted-foreground 2xl:text-lg">{stat.label}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="bg-card/25 py-12 lg:py-14">
        <div className="site-shell max-w-[2400px]">
          <div className="mx-auto max-w-[1800px]">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground md:text-4xl 2xl:text-[44px]">我们的原则</h2>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {principles.map((principle, index) => {
                const Icon = principle.icon
                return (
                  <article key={principle.title} className="surface-card about-card-tone-cyan group relative flex min-h-[150px] items-start gap-5 rounded-lg p-7 pr-16 2xl:p-8 2xl:pr-20">
                    <Icon className="surface-card-icon mt-1 size-8 shrink-0 text-primary" />
                    <div>
                      <h3 className="text-xl font-bold text-foreground 2xl:text-2xl">{principle.title}</h3>
                      <p className="mt-2 text-base leading-7 text-muted-foreground 2xl:text-lg 2xl:leading-8">{principle.description}</p>
                    </div>
                    <span className="about-card-accent absolute right-7 top-6 font-mono text-lg font-bold">0{index + 1}</span>
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
