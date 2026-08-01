"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import SectionIntro from "@/components/section-intro"

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const faqs = [
    {
      question: "平台支持哪些集合运算？",
      answer:
        "平台支持多方集合求交、求并、交集数量统计、交集数据求和，以及 Private-ID 隐私标识对齐。",
    },
    {
      question: "原始数据会被其他参与方看到吗？",
      answer:
        "不会。各方分别持有自己的数据，计算过程中只传递协议所需的信息，最终仅输出约定的集合结果或统计值。",
    },
    {
      question: "一次运算可以有多少个参与方？",
      answer:
        "运行面板支持 2 至 10 个参与方，可根据实际协作规模选择参与方数量。",
    },
    {
      question: "运行完成后可以查看哪些信息？",
      answer:
        "可以查看计算结果、在线耗时、通信量和性能对比，便于了解本次任务的执行情况。",
    },
    {
      question: "平台适用于哪些场景？",
      answer:
        "适用于跨机构名单匹配、共同用户统计、联合风险分析、共同数据求和和跨方标识对齐等场景。",
    },
  ]

  return (
    <section id="faq" className="relative overflow-hidden bg-background py-20 scroll-mt-20 lg:py-20">
      <div className="site-shell max-w-[2400px]">
        <SectionIntro
          eyebrow="常见问题"
          title="开始前需要了解的内容"
          mobileTitleLines={["开始前需要", "了解的内容"]}
          description="关于多方隐私集合运算平台的快速说明。"
          hideDesktopEyebrow
          hideDesktopDescription
          className="lg:mb-10"
        />

        <div className="space-y-4 lg:hidden">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-accent"
            >
              <button
                type="button"
                className="w-full px-6 py-5 md:px-8 md:py-6 flex items-center justify-between gap-5 hover:bg-accent/10 transition-colors cursor-pointer"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                aria-expanded={openIndex === index}
              >
                <h3 className="text-xl md:text-2xl font-semibold text-foreground text-left">{faq.question}</h3>
                <ChevronDown
                  className={`w-6 h-6 text-primary flex-shrink-0 transition-transform ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                />
              </button>

              {openIndex === index && (
                <div className="px-6 pb-6 border-t border-border bg-muted/45 pt-5 text-lg leading-8 text-muted-foreground md:px-8 md:pb-8 md:text-xl md:leading-9">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="hidden space-y-4 lg:block">
          {faqs.map((faq, index) => (
            <div
              key={faq.question}
              className="surface-card overflow-hidden rounded-lg lg:border-primary/35"
            >
              <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-between gap-5 px-9 py-7 text-left transition-colors hover:bg-accent/10"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                aria-expanded={openIndex === index}
              >
                <h3 className="text-2xl font-bold text-foreground 2xl:text-[28px]">{faq.question}</h3>
                <ChevronDown className={`size-6 shrink-0 text-primary transition-transform ${openIndex === index ? 'rotate-180' : ''}`} />
              </button>
              {openIndex === index ? (
                <div className="border-t border-border bg-background/45 px-9 pb-8 pt-6 text-xl leading-9 text-muted-foreground 2xl:text-[22px] 2xl:leading-10">
                  {faq.answer}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
