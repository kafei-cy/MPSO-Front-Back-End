"use client"

import { useEffect, useRef } from "react"
import { CheckCircle2, Database, Fingerprint, LockKeyhole } from "lucide-react"

export default function DashboardPreview() {
  const flowAreaRef = useRef<HTMLDivElement>(null)
  const upperPathRef = useRef<SVGPathElement>(null)
  const lowerPathRef = useRef<SVGPathElement>(null)
  const outputPathRef = useRef<SVGPathElement>(null)
  const upperPacketRef = useRef<HTMLSpanElement>(null)
  const lowerPacketRef = useRef<HTMLSpanElement>(null)
  const outputPacketRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const flowArea = flowAreaRef.current
    const upperPath = upperPathRef.current
    const lowerPath = lowerPathRef.current
    const outputPath = outputPathRef.current
    const upperPacket = upperPacketRef.current
    const lowerPacket = lowerPacketRef.current
    const outputPacket = outputPacketRef.current

    if (!flowArea || !upperPath || !lowerPath || !outputPath || !upperPacket || !lowerPacket || !outputPacket) {
      return
    }

    const paths = [upperPath, lowerPath, outputPath]
    const packets = [upperPacket, lowerPacket, outputPacket]
    const lengths = paths.map((path) => path.getTotalLength())
    const size = { width: flowArea.clientWidth, height: flowArea.clientHeight }
    const resizeObserver = new ResizeObserver(() => {
      size.width = flowArea.clientWidth
      size.height = flowArea.clientHeight
    })
    resizeObserver.observe(flowArea)

    const durationMs = 3200
    const startTime = performance.now()
    let animationFrame = 0

    const animate = (time: number) => {
      const progress = ((time - startTime) % durationMs) / durationMs

      paths.forEach((path, index) => {
        const point = path.getPointAtLength(lengths[index] * progress)
        const x = (point.x / 740) * size.width
        const y = (point.y / 350) * size.height
        packets[index].style.transform = `translate3d(${x - 5}px, ${y - 5}px, 0)`
        packets[index].style.opacity = '1'
      })

      animationFrame = requestAnimationFrame(animate)
    }

    animationFrame = requestAnimationFrame(animate)
    return () => {
      cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
    }
  }, [])

  return (
    <div className="relative w-full overflow-hidden rounded-lg border-2 border-primary/50 bg-card/95 p-6 shadow-[0_0_40px_rgba(0,255,153,0.10)]">
      <div className="pointer-events-none absolute inset-0 opacity-25" aria-hidden="true">
        <svg className="h-full w-full">
          <defs>
            <pattern id="hero-panel-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M28 0H0V28" fill="none" stroke="#2a3d34" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-panel-grid)" />
        </svg>
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <p className="text-lg font-bold text-foreground">安全运算流程</p>
            <p className="mt-1 text-base text-muted-foreground">多方数据在本地保留，仅传输协议消息</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-primary/35 bg-background/70 px-3 py-1.5 text-base text-primary">
            <span className="size-2 rounded-full bg-primary shadow-[0_0_10px_rgba(0,255,153,0.9)]"></span>
            协议运行中
          </div>
        </div>

        <div ref={flowAreaRef} className="relative mt-4 h-[350px]">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 740 350" preserveAspectRatio="none" fill="none" aria-hidden="true">
            <defs>
              <marker id="hero-flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0 0L10 5L0 10Z" fill="#00ffff" />
              </marker>
            </defs>
            <path ref={upperPathRef} d="M185 83C232 83 232 175 274 175" stroke="#00ffff" strokeOpacity="0.55" strokeWidth="2" strokeDasharray="6 7" markerEnd="url(#hero-flow-arrow)" />
            <path ref={lowerPathRef} d="M185 267C232 267 232 175 274 175" stroke="#00ffff" strokeOpacity="0.55" strokeWidth="2" strokeDasharray="6 7" markerEnd="url(#hero-flow-arrow)" />
            <path ref={outputPathRef} d="M466 175H555" stroke="#00ff99" strokeWidth="2.5" strokeDasharray="7 7" markerEnd="url(#hero-flow-arrow)" />

          </svg>

          <span ref={upperPacketRef} className="hero-flow-packet hero-flow-packet-upper" aria-hidden="true" />
          <span ref={lowerPacketRef} className="hero-flow-packet hero-flow-packet-lower" aria-hidden="true" />
          <span ref={outputPacketRef} className="hero-flow-packet hero-flow-packet-output" aria-hidden="true" />

          <div className="absolute left-0 top-7 w-1/4 rounded-lg border-2 border-accent/40 bg-background/95 p-4 shadow-lg">
            <div className="flex items-center gap-2 text-base font-bold"><Database className="size-5 text-accent" />参与方 A</div>
            <p className="mt-3 font-mono text-base text-accent">{`{a, b, c}`}</p>
            <p className="mt-2 text-base text-muted-foreground">本地私有集合</p>
          </div>

          <div className="absolute bottom-7 left-0 w-1/4 rounded-lg border-2 border-primary/40 bg-background/95 p-4 shadow-lg">
            <div className="flex items-center gap-2 text-base font-bold"><Database className="size-5 text-primary" />参与方 B</div>
            <p className="mt-3 font-mono text-base text-primary">{`{b, c, d}`}</p>
            <p className="mt-2 text-base text-muted-foreground">本地私有集合</p>
          </div>

          <div className="absolute left-1/2 top-1/2 w-[26%] -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-primary/70 bg-background p-5 shadow-[0_0_28px_rgba(0,255,153,0.13)]">
            <div className="flex items-center justify-between">
              <LockKeyhole className="size-6 text-primary" />
              <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-sm font-medium text-primary">安全计算</span>
            </div>
            <p className="mt-6 whitespace-nowrap text-lg font-bold">隐私集合求交</p>
            <p className="mt-2 text-base leading-6 text-muted-foreground">匹配过程中不公开原始数据</p>
          </div>

          <div className="absolute right-0 top-1/2 w-1/4 -translate-y-1/2 rounded-lg border-2 border-primary/55 bg-background/95 p-5 shadow-lg">
            <div className="flex items-center gap-2 text-base font-bold"><CheckCircle2 className="size-5 text-primary" />共同结果</div>
            <p className="mt-4 font-mono text-2xl font-bold text-primary">{`{b, c}`}</p>
            <div className="mt-4 flex items-center gap-1.5 pt-3 text-base text-muted-foreground">
              <Fingerprint className="size-3.5" />仅输出约定结果
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
