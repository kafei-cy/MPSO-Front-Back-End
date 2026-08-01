"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NavigationMenu, NavigationMenuList, NavigationMenuItem } from "@/components/ui/navigation-menu"

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = [
    { label: "首页", href: "/" },
    { label: "关于我们", href: "/about" },
    { label: "功能服务", href: "/services" },
    { label: "功能详情", href: "/feature-details" },
    { label: "运行面板", href: "/contact" },
  ]

  return (
    <nav className="fixed inset-x-0 top-0 z-50 bg-background/95 shadow-[0_12px_32px_rgba(0,0,0,0.28)] lg:border-b lg:border-border/70 lg:backdrop-blur-md">
      <div className="site-shell max-w-[2400px]">
        <div className="flex h-[72px] items-center justify-between lg:h-20">
          {/* Logo */}
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="grid size-8 grid-cols-2 gap-1 p-0.5" aria-hidden="true">
              <span className="rounded-[3px] border-2 border-foreground"></span>
              <span className="rounded-[3px] border-2 border-primary bg-primary/10"></span>
              <span className="rounded-[3px] border-2 border-foreground"></span>
              <span className="rounded-[3px] border-2 border-foreground"></span>
            </div>
            <span className="text-xl font-bold text-foreground lg:text-2xl">CypherO</span>
          </Link>

          {/* Navigation Menu */}
          <NavigationMenu>
            <NavigationMenuList>
              {navLinks.map((link) => (
                <NavigationMenuItem key={link.label}>
                  <Link href={link.href} className="hidden px-4 py-2 text-lg font-semibold text-foreground/80 transition-colors hover:text-accent lg:inline xl:px-5">
                    {link.label}
                  </Link>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>

          {/* Right Section: CTA */}
          <div className="hidden lg:flex items-center gap-4">
            {/* CTA Button */}
            <Link href="/contact">
              <Button
                size="lg"
                className="h-12 rounded-full bg-primary px-7 text-base font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/85"
              >
                <Shield className="w-4 h-4" />
                快速开始
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors text-foreground"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="space-y-2 bg-card py-4 lg:hidden">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="block rounded-lg px-4 py-3 text-base font-medium text-foreground transition-colors hover:bg-muted hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
            <div className="px-4 py-2 space-y-2">
              <Link href="/contact" className="w-full">
                <Button
                  size="lg"
                  className="w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  快速开始
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
