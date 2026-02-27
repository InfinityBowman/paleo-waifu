import { createFileRoute } from '@tanstack/react-router'
import { Hero } from '@/components/landing/Hero'

export const Route = createFileRoute('/_public/')({
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className="min-h-screen">
      <Hero />
    </div>
  )
}
