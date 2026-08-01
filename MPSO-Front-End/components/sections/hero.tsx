"use client"

import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import DashboardPreview from "@/components/dashboard-preview"

export default function Hero() {
  return (
    <section className="relative flex min-h-[min(720px,calc(100svh-4.5rem))] items-center overflow-hidden bg-background py-16 lg:min-h-0 lg:pb-10 lg:pt-32 2xl:pb-12 2xl:pt-36">
      <div className="site-shell relative z-20 max-w-[2400px]">
        <div className="grid items-center gap-12 xl:grid-cols-[minmax(0,0.9fr)_minmax(720px,1.1fr)] xl:gap-10 2xl:gap-12">
          <div className="max-w-[920px] space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/45 bg-card px-3 py-1.5 text-primary shadow-[0_0_18px_rgba(0,255,153,0.08)]">
              <Sparkles className="w-4 h-4" />
              <span className="text-base font-medium">多方数据安全协作平台</span>
            </div>

            <div className="space-y-5">
              <h1 className="text-4xl font-bold leading-[1.12] text-foreground md:text-5xl xl:text-7xl 2xl:text-[76px]">
                <span className="block">多方隐私集合</span>
                <span className="block text-primary">运算专用平台</span>
              </h1>
             
              <p className="max-w-[920px] text-lg leading-8 text-muted-foreground xl:text-2xl xl:leading-10 2xl:text-[26px]">
                无需汇总原始数据，安全完成交集、并集、统计、求和与标识对齐。
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full bg-primary px-7 font-semibold text-primary-foreground shadow-md hover:bg-primary/85 lg:h-14 lg:px-8 lg:text-lg"
              >
                <Link href="/contact">
                  快速开始
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-2 border-primary/70 bg-card px-7 font-semibold text-primary hover:bg-secondary lg:h-14 lg:px-8 lg:text-lg"
              >
                <Link href="/feature-details">了解更多</Link>
              </Button>
            </div>

            <div className="max-w-[920px] pt-3 text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="h-6 w-1 rounded-full bg-primary" aria-hidden="true"></span>
                <p className="text-base font-medium leading-7 lg:text-lg">
                  <span className="block sm:inline">山东大学网络空间安全学院</span>
                  <span className="block sm:inline"><span className="hidden sm:inline"> · </span>隐私保护计算课题组</span>
                </p>
              </div>
              <p className="mt-3 hidden max-w-[960px] text-lg leading-8 text-muted-foreground lg:block 2xl:text-xl 2xl:leading-9">
                Minglang Dong, Yu Chen, Cong Zhang, Yujie Bai, and Yang Cao.<br />
                <cite className="not-italic text-foreground/90">Multi-Party Private Set Operations from Predicative Zero-Sharing.</cite>{' '}
                ACM CCS 2025.
              </p>
            </div>
          </div>

          <div className="hidden xl:block">
            <div className="w-full">
              <DashboardPreview />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
