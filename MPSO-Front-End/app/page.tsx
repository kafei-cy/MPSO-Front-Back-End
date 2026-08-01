import Hero from "@/components/sections/hero"
import Problem from "@/components/sections/problem"
import Solution from "@/components/sections/solution"
import Features from "@/components/sections/features"
import UseCases from "@/components/sections/use-cases"
import FAQ from "@/components/sections/faq"
import Footer from "@/components/sections/footer"


export default function Home() {
  return (
    <main className="bg-background text-foreground overflow-hidden">
      <div>
        <Hero />
        <Problem />
        <Solution />
        <Features />
        <UseCases />
        <FAQ />
        <Footer />
       </div>
    </main>
  )
}
