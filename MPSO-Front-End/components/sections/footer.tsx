"use client"

export default function Footer() {
  return (
    <footer className="relative bg-card/20">
      <div className="site-shell max-w-[2400px] py-9">
        <div className="flex flex-col items-center justify-between gap-5 md:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="grid size-7 grid-cols-2 gap-1 p-0.5" aria-hidden="true">
              <span className="rounded-[2px] border-[1.5px] border-foreground"></span>
              <span className="rounded-[2px] border-[1.5px] border-primary bg-primary/10"></span>
              <span className="rounded-[2px] border-[1.5px] border-foreground"></span>
              <span className="rounded-[2px] border-[1.5px] border-foreground"></span>
            </div>
            <span className="text-lg font-bold text-foreground">CypherO</span>
          </div>

          <p className="text-center text-base text-muted-foreground md:text-right">© 2026 CypherO · 多方隐私集合运算平台</p>
        </div>
      </div>
    </footer>
  )
}
