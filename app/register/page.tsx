'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Car,
  CheckCircle,
  Clock3,
  Shield,
  Star,
  Store,
  Users,
  Zap,
} from 'lucide-react';
import { useRegisterScrollMotion } from '@/components/RegisterMotion';

const driverHighlights = [
  {
    title: 'Flexible Schedule',
    description: 'Drive on your own time, whether full-time or side hustle.',
  },
  {
    title: 'Stable Earnings',
    description: 'Keep your workflow moving with ride demand and delivery options.',
  },
  {
    title: 'Built-In Safety',
    description: 'Use platform safeguards, trip visibility, and support tools.',
  },
];

const merchantHighlights = [
  {
    title: 'Multi-Category Storefront',
    description: 'List food, vape, or medicine products under the right customer category.',
  },
  {
    title: 'Simple Catalog Control',
    description: 'Manage products, availability, store status, and incoming orders in one place.',
  },
  {
    title: 'Local Delivery Reach',
    description: 'Connect with nearby customers and use Pasakay delivery for faster fulfillment.',
  },
];

const driverRequirements = [
  'Valid driver’s license',
  'Motorcycle or tricycle',
  'Vehicle registration (OR/CR)',
  'Android or iOS smartphone',
];

const merchantRequirements = [
  'Valid business permit',
  'Food, vape, pharmacy, or essentials business',
  'Required permits for your business type',
  'Business contact information',
];

const partnerBenefits = [
  {
    icon: Shield,
    title: 'Reliable Platform',
    description: 'Operate on a system designed for daily ride and delivery activity.',
  },
  {
    icon: Clock3,
    title: 'Fast Onboarding',
    description: 'Submit requirements, get reviewed, and start moving faster.',
  },
  {
    icon: Users,
    title: 'Growing Demand',
    description: 'Connect with repeat passengers, food customers, and local orders.',
  },
  {
    icon: Zap,
    title: 'Operational Tools',
    description: 'Use a cleaner dashboard and live activity updates to stay productive.',
  },
];

function FeatureList({
  items,
}: {
  items: { title: string; description: string }[];
}) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.title} className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full border border-white/12 bg-white/6 p-1.5">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">{item.title}</h4>
            <p className="mt-1 text-sm leading-6 text-zinc-400">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RequirementsList({ items }: { items: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 p-4 sm:p-5">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-300">
        Requirements
      </p>
      <ul className="mt-4 space-y-2 text-sm text-zinc-400">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-500" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function RegisterLandingPage() {
  const router = useRouter();
  const pageRef = useRef<HTMLElement | null>(null);
  useRegisterScrollMotion(pageRef);

  return (
    <main ref={pageRef} className="min-h-screen bg-[#050505] text-white">
      <div
        className="relative min-h-screen overflow-hidden"
        style={{
          backgroundColor: '#050505',
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
          backgroundPosition: '0 0',
        }}
      >
        <header className="sticky top-0 z-50 border-b border-white/10 bg-black/55 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-3 rounded-full border border-white/10 bg-white/6 px-3 py-2 text-left transition hover:border-white/20 hover:bg-white/10"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-sm font-bold text-black shadow-[0_0_40px_rgba(255,255,255,0.12)]">
                P
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight text-white">Pasakay</p>
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                  Partner Registration
                </p>
              </div>
            </button>

            <div className="hidden items-center gap-3 md:flex">
              <div className="rounded-full border border-emerald-400/20 bg-emerald-400/8 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">
                Open For Applications
              </div>
            </div>
          </div>
        </header>

        <section className="mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:px-8 lg:pb-24 lg:pt-20">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div className="max-w-3xl">
              <div className="gsap-hero inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-zinc-300">
                <Star className="h-3.5 w-3.5 text-amber-300" />
                Build With Pasakay
              </div>

              <h1 className="gsap-hero mt-6 max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-7xl">
                Join the local mobility and delivery network built for faster daily work.
              </h1>

              <p className="gsap-hero mt-6 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
                Choose the lane that fits you. Drive passengers across your city or
                turn your store into a delivery-ready business with faster onboarding
                and clearer tools.
              </p>

              <div className="gsap-hero mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-semibold text-white">24/7</p>
                  <p className="mt-2 text-sm text-zinc-400">Platform availability for orders and trips</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-semibold text-white">2 Paths</p>
                  <p className="mt-2 text-sm text-zinc-400">Driver and merchant registration in one place</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-semibold text-white">Fast</p>
                  <p className="mt-2 text-sm text-zinc-400">Cleaner requirements and approval flow</p>
                </div>
              </div>
            </div>

            <div className="gsap-card rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)] sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {partnerBenefits.map((benefit) => {
                  const Icon = benefit.icon;
                  return (
                    <div
                      key={benefit.title}
                      className="rounded-2xl border border-white/8 bg-black/30 p-5"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8">
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="mt-4 text-base font-semibold text-white">
                        {benefit.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        {benefit.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-12 grid gap-6 xl:grid-cols-2">
            <section className="gsap-card overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0a0a]/90 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <div className="border-b border-white/10 bg-white/[0.04] p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-white/10 bg-white/10">
                      <Car className="h-7 w-7 text-white" />
                    </div>
                    <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white">
                      Drive with Pasakay
                    </h2>
                    <p className="mt-3 max-w-md text-sm leading-6 text-blue-100/75 sm:text-base">
                      For riders, delivery support, and drivers who want a cleaner daily earning flow.
                    </p>
                  </div>
                  <div className="rounded-full border border-blue-300/20 bg-blue-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-blue-100">
                    Driver
                  </div>
                </div>
              </div>

              <div className="space-y-6 p-6 sm:p-8">
                <FeatureList items={driverHighlights} />
                <RequirementsList items={driverRequirements} />

                <button
                  onClick={() => router.push('/register/driver')}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-black transition hover:bg-zinc-200"
                >
                  Register as Driver
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>

            <section className="gsap-card overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0a0a]/90 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <div className="border-b border-white/10 bg-white/[0.04] p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-white/10 bg-white/10">
                      <Store className="h-7 w-7 text-white" />
                    </div>
                    <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white">
                      Sell on Pasakay
                    </h2>
                    <p className="mt-3 max-w-md text-sm leading-6 text-fuchsia-100/75 sm:text-base">
                      For food shops, vape stores, pharmacies, and essentials sellers that want cleaner online ordering and local delivery reach.
                    </p>
                  </div>
                  <div className="rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-fuchsia-100">
                    Merchant
                  </div>
                </div>
              </div>

              <div className="space-y-6 p-6 sm:p-8">
                <FeatureList items={merchantHighlights} />
                <RequirementsList items={merchantRequirements} />

                <button
                  onClick={() => router.push('/register/merchant')}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-black transition hover:bg-zinc-200"
                >
                  Register as Merchant
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
