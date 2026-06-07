import { ArrowRight, Boxes, Github, Rocket, Shield } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Github,
    title: "GitHub-connected onboarding",
    description: "Connect repos, read builds from GitHub webhooks, and track every deployment in one dashboard."
  },
  {
    icon: Rocket,
    title: "BullMQ build pipeline",
    description: "Run isolated builds, capture logs, and upload artifacts into R2 under stable deployment paths."
  },
  {
    icon: Shield,
    title: "Cloudflare edge serving",
    description: "Serve static assets from the nearest edge with deterministic cache headers and MIME types."
  }
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <section className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:px-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-cyan-300 shadow-glow">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300">Hosting Platform</p>
              <p className="text-xs text-slate-500">Self-hosted GitHub + Cloudflare MVP</p>
            </div>
          </div>
          <Link href="/dashboard">
            <Button variant="secondary">
              Open dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid flex-1 items-center gap-14 py-16 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-medium text-cyan-200">
              GitHub builds to Cloudflare edge, without a SaaS dependency.
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Ship static sites like a platform you control.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              A working MVP for onboarding repositories, running build jobs, storing artifacts in R2, and serving them from Cloudflare Workers.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/dashboard">
                <Button size="lg">
                  Start onboarding
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline">
                  View features
                </Button>
              </a>
            </div>
          </div>

          <div className="space-y-4">
            {features.map((feature) => (
              <Card key={feature.title} className="relative overflow-hidden">
                <CardHeader>
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8 text-cyan-300">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-px w-full bg-white/10" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

