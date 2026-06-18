'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Car,
  CheckCircle,
  Clock3,
  FileCheck,
  MapPin,
  Shield,
  ShieldCheck,
  Smartphone,
  Store,
  Users,
  Zap,
} from 'lucide-react';
import { useRegisterScrollMotion } from '@/components/RegisterMotion';

type PartnerPath = 'driver' | 'merchant';

type PartnerPathDetails = {
  badge: string;
  title: string;
  shortTitle: string;
  description: string;
  cta: string;
  href: string;
  icon: typeof Car;
  color: string;
  softColor: string;
  buttonClass: string;
  activeClass: string;
  highlights: { title: string; description: string }[];
  requirements: string[];
  steps: string[];
  stats: { label: string; value: string }[];
};

const partnerPaths: Record<PartnerPath, PartnerPathDetails> = {
  driver: {
    badge: 'Driver',
    title: 'Drive with Pasakay',
    shortTitle: 'Driver',
    description:
      'For riders, delivery support, and drivers who want a cleaner daily earning flow.',
    cta: 'Register as Driver',
    href: '/register/driver',
    icon: Car,
    color: 'text-[#1f6f68]',
    softColor: 'bg-[#e8f4f2]',
    buttonClass: 'bg-[#1f6f68] hover:bg-[#174c49] focus-visible:ring-[#1f6f68]/30',
    activeClass: 'border-[#1f6f68] shadow-[#1f6f68]/10',
    highlights: [
      {
        title: 'Flexible schedule',
        description: 'Drive on your own time, whether full-time or side hustle.',
      },
      {
        title: 'Stable earnings',
        description: 'Keep your workflow moving with ride demand and delivery options.',
      },
      {
        title: 'Built-in safety',
        description: 'Use platform safeguards, trip visibility, and support tools.',
      },
    ],
    requirements: [
      "Valid driver's license",
      'Motorcycle or tricycle',
      'Vehicle registration (OR/CR)',
      'Android or iOS smartphone',
    ],
    steps: ['Create profile', 'Upload vehicle papers', 'Admin review', 'Start accepting work'],
    stats: [
      { label: 'Path', value: 'Rides' },
      { label: 'Tools', value: 'Trips' },
      { label: 'Mode', value: 'Mobile' },
    ],
  },
  merchant: {
    badge: 'Merchant',
    title: 'Sell on Pasakay',
    shortTitle: 'Merchant',
    description:
      'For food shops, vape stores, pharmacies, and essentials sellers that want online ordering and local delivery reach.',
    cta: 'Register as Merchant',
    href: '/register/merchant',
    icon: Store,
    color: 'text-[#a46312]',
    softColor: 'bg-[#fff3d9]',
    buttonClass: 'bg-[#a46312] hover:bg-[#86510d] focus-visible:ring-[#a46312]/30',
    activeClass: 'border-[#a46312] shadow-[#a46312]/10',
    highlights: [
      {
        title: 'Multi-category storefront',
        description: 'List food, vape, or medicine products under the right customer category.',
      },
      {
        title: 'Simple catalog control',
        description: 'Manage products, availability, store status, and incoming orders in one place.',
      },
      {
        title: 'Local delivery reach',
        description: 'Connect with nearby customers and use Pasakay delivery for faster fulfillment.',
      },
    ],
    requirements: [
      'Valid business permit',
      'Food, vape, pharmacy, or essentials business',
      'Required permits for your business type',
      'Business contact information',
    ],
    steps: ['Add business profile', 'Submit permits', 'Configure catalog', 'Receive local orders'],
    stats: [
      { label: 'Path', value: 'Store' },
      { label: 'Tools', value: 'Orders' },
      { label: 'Mode', value: 'Catalog' },
    ],
  },
};

const partnerBenefits = [
  {
    icon: Shield,
    title: 'Reliable platform',
    description: 'Operate on a system designed for daily ride and delivery activity.',
  },
  {
    icon: Clock3,
    title: 'Fast onboarding',
    description: 'Submit requirements, get reviewed, and start moving faster.',
  },
  {
    icon: Users,
    title: 'Growing demand',
    description: 'Connect with repeat passengers, food customers, and local orders.',
  },
  {
    icon: Zap,
    title: 'Operational tools',
    description: 'Use a cleaner dashboard and live activity updates to stay productive.',
  },
];

const appAvailability = [
  {
    platform: 'Android',
    label: 'Google Play',
  },
  {
    platform: 'iOS',
    label: 'App Store',
  },
];

const pathOrder: PartnerPath[] = ['driver', 'merchant'];

function FeatureList({
  items,
  tone,
}: {
  items: { title: string; description: string }[];
  tone: PartnerPath;
}) {
  const toneClass = tone === 'driver' ? 'text-[#1f6f68] bg-[#e8f4f2]' : 'text-[#a46312] bg-[#fff3d9]';

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.title} className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${toneClass}`}>
            <CheckCircle className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#18211f]">{item.title}</h4>
            <p className="mt-1 text-sm leading-6 text-[#66736f]">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RequirementsList({ items }: { items: string[] }) {
  return (
    <div className="border-t border-[#e5e2d8] pt-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#66736f]">
        Requirements
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex min-h-10 items-center gap-2 rounded-md border border-[#e7e4da] bg-[#fbfcf9] px-3 py-2 text-sm text-[#4f5b57]"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#1f6f68]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StoreBrandMark({ platform }: { platform: string }) {
  if (platform === 'Android') {
    return (
      <svg viewBox="0 0 44 44" className="h-8 w-8" aria-hidden="true">
        <defs>
          <linearGradient id="playBlue" x1="9" x2="28" y1="7" y2="23" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00A0FF" />
            <stop offset="1" stopColor="#00D2FF" />
          </linearGradient>
          <linearGradient id="playGreen" x1="7" x2="27" y1="6" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00F076" />
            <stop offset="1" stopColor="#00C853" />
          </linearGradient>
          <linearGradient id="playYellow" x1="21" x2="36" y1="18" y2="24" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFE000" />
            <stop offset="1" stopColor="#FFB300" />
          </linearGradient>
          <linearGradient id="playRed" x1="9" x2="29" y1="37" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FF3D00" />
            <stop offset="1" stopColor="#FF7043" />
          </linearGradient>
        </defs>
        <path d="M9.5 7.8c-.7.4-1.1 1.2-1.1 2.3v23.8c0 1.1.4 1.9 1.1 2.3l14-14.2-14-14.2Z" fill="url(#playBlue)" />
        <path d="m9.8 7.6 17.5 10.1-3.8 4.3L9.8 7.6Z" fill="url(#playGreen)" />
        <path d="m27.3 17.7 6.3 3.6c1.9 1.1 1.9 2.6 0 3.7l-6.3 3.6-3.8-6.6 3.8-4.3Z" fill="url(#playYellow)" />
        <path d="M9.8 36.4 23.5 22l3.8 6.6L9.8 36.4Z" fill="url(#playRed)" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 44 44" className="h-8 w-8" aria-hidden="true">
      <path
        d="M28.8 22.8c0-3 2.5-4.6 2.7-4.7-1.4-2.1-3.6-2.4-4.4-2.4-1.8-.2-3.6 1.1-4.5 1.1-.9 0-2.4-1.1-3.9-1-2 0-3.9 1.2-4.9 3-2.1 3.6-.5 8.9 1.5 11.8 1 1.4 2.2 3.1 3.7 3 1.5-.1 2.1-1 3.9-1s2.3 1 3.9.9c1.6 0 2.6-1.5 3.6-3 1.1-1.7 1.6-3.3 1.6-3.4-.1 0-3.2-1.2-3.2-4.3Z"
        fill="currentColor"
      />
      <path
        d="M25.9 13.7c.8-1 1.4-2.4 1.2-3.8-1.2.1-2.6.8-3.5 1.8-.8.9-1.5 2.3-1.3 3.7 1.4.1 2.8-.7 3.6-1.7Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function RegisterLandingPage() {
  const router = useRouter();
  const pageRef = useRef<HTMLElement | null>(null);
  const [activePath, setActivePath] = useState<PartnerPath>('driver');
  const activePathData = useMemo(() => partnerPaths[activePath], [activePath]);
  const ActivePathIcon = activePathData.icon;
  useRegisterScrollMotion(pageRef);

  return (
    <main ref={pageRef} className="min-h-screen bg-[#f7f8f5] text-[#18211f]">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.42]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(31, 111, 104, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(31, 111, 104, 0.06) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />

      <div className="relative">
        <header className="sticky top-0 z-50 border-b border-[#dfe5e1] bg-[#f7f8f5]/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-2 text-left transition hover:border-[#dfe5e1] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f68]/25"
            >
              <img
                src="/pasakay-logo.jpg"
                alt="Pasakay logo"
                className="h-10 w-10 rounded-md bg-white object-cover shadow-sm"
              />
              <div>
                <p className="text-base font-bold leading-none tracking-tight text-[#18211f]">
                  Pasakay
                </p>
                <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#66736f]">
                  Partner registration
                </p>
              </div>
            </button>

            <div className="hidden items-center gap-3 md:flex">
              <span className="rounded-md border border-[#cde5de] bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#1f6f68]">
                Open for applications
              </span>
            </div>
          </div>
        </header>

        <section className="mx-auto grid min-h-[calc(100vh-73px)] w-full max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:px-8 lg:py-14">
          <div className="max-w-3xl">
            <div className="gsap-hero inline-flex items-center gap-2 rounded-md border border-[#dfe5e1] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#1f6f68] shadow-sm">
              <Shield className="h-3.5 w-3.5" />
              Build with Pasakay
            </div>

            <h1 className="gsap-hero mt-6 max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight text-[#18211f] sm:text-5xl lg:text-6xl">
              Pick your Pasakay path and get ready for local trips, orders, and delivery.
            </h1>

            <p className="gsap-hero mt-6 max-w-2xl text-base leading-relaxed text-[#66736f] sm:text-lg">
              Choose the lane that fits your work. Drivers get trip-ready onboarding;
              merchants get a setup path for storefronts, catalogs, and local delivery.
            </p>

            <div className="gsap-hero mt-8 grid max-w-xl grid-cols-2 gap-2 rounded-lg border border-[#dfe5e1] bg-white p-1 shadow-sm">
              {pathOrder.map((path) => {
                const item = partnerPaths[path];
                const Icon = item.icon;
                const isActive = activePath === path;

                return (
                  <button
                    key={path}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setActivePath(path)}
                    className={`flex min-h-14 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 ${
                      isActive
                        ? `${item.softColor} ${item.color}`
                        : 'text-[#66736f] hover:bg-[#f3f6f2] hover:text-[#18211f]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.shortTitle}
                  </button>
                );
              })}
            </div>

            <div className="gsap-hero mt-6 flex flex-wrap gap-3">
              {appAvailability.map((item) => {
                return (
                  <div
                    key={item.platform}
                    className="inline-flex min-h-16 items-center gap-3 rounded-md border border-[#d4dad6] bg-white px-4 py-3 shadow-sm"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[#111917] text-white">
                      <StoreBrandMark platform={item.platform} />
                    </span>
                    <span>
                      <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a837f]">
                        {item.platform}
                      </span>
                      <span className="block text-[17px] font-bold leading-tight text-[#18211f]">{item.label}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="gsap-card overflow-hidden rounded-lg border border-[#153432] bg-[#10201e] p-6 text-white shadow-xl shadow-[#10201e]/20 sm:p-8">
            <div className="flex items-start justify-between gap-5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#f4b84d]">
                  Live path preview
                </span>
                <h2 className="mt-3 text-2xl font-bold tracking-tight">{activePathData.title}</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-white/68">
                  {activePathData.description}
                </p>
              </div>
              <img
                src="/pasakay-logo.jpg"
                alt="Pasakay logo"
                className="h-14 w-14 shrink-0 rounded-md border border-white/15 bg-white object-cover shadow-sm"
              />
            </div>

            <div className="mt-7 grid grid-cols-3 divide-x divide-white/10 border-y border-white/10 py-4">
              {activePathData.stats.map((stat) => (
                <div key={stat.label} className="px-3 first:pl-0 last:pr-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-lg font-bold text-white">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-7">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">
                  Application flow
                </p>
                <ActivePathIcon className={`h-5 w-5 ${activePath === 'driver' ? 'text-[#78d1c8]' : 'text-[#f4b84d]'}`} />
              </div>

              <div className="mt-5 space-y-4">
                {activePathData.steps.map((step, index) => (
                  <div key={step} className="grid grid-cols-[2rem_1fr] gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                          index === 0
                            ? 'bg-white text-[#10201e]'
                            : 'border border-white/15 bg-white/5 text-white/70'
                        }`}
                      >
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex min-h-8 items-center justify-between gap-3 border-b border-white/10 pb-4 last:border-b-0 last:pb-0">
                      <span className="text-sm font-semibold text-white/88">{step}</span>
                      {index === 0 ? (
                        <span className="rounded-md bg-emerald-300/15 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-200">
                          Active
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => router.push(activePathData.href)}
              className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-4 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 ${activePathData.buttonClass}`}
            >
              {activePathData.cta}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        <section className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen pb-16 lg:pb-20">
          <div className="gsap-card overflow-hidden border-y border-[#dfe5e1] py-6">
            <div className="benefit-marquee" aria-label="Pasakay partner benefits">
              <div className="benefit-marquee-track">
                {[...partnerBenefits, ...partnerBenefits].map((benefit, index) => {
                  const Icon = benefit.icon;
                  return (
                    <div key={`${benefit.title}-${index}`} className="benefit-marquee-item">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-[#1f6f68] shadow-sm ring-1 ring-[#dfe5e1]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block whitespace-nowrap text-sm font-bold text-[#18211f]">
                          {benefit.title}
                        </span>
                        <span className="mt-1 block max-w-[260px] text-xs leading-5 text-[#66736f]">
                          {benefit.description}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-20 sm:px-6 lg:grid-cols-2 lg:px-8">
          {pathOrder.map((path) => {
            const pathData = partnerPaths[path];
            const Icon = pathData.icon;
            const isActive = activePath === path;

            return (
              <article
                key={path}
                onMouseEnter={() => setActivePath(path)}
                onFocusCapture={() => setActivePath(path)}
                className={`gsap-card overflow-hidden rounded-lg border bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg ${isActive ? pathData.activeClass : 'border-[#dfe5e1] shadow-[#18211f]/5'}`}
              >
                <div className="p-6 sm:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-md ${pathData.softColor} ${pathData.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className={`rounded-md px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${pathData.softColor} ${pathData.color}`}>
                      {pathData.badge}
                    </span>
                  </div>

                  <h2 className="mt-5 text-2xl font-bold tracking-tight text-[#18211f] sm:text-3xl">
                    {pathData.title}
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-[#66736f]">
                    {pathData.description}
                  </p>

                  <div className="mt-6 grid grid-cols-3 divide-x divide-[#e5e2d8] border-y border-[#e5e2d8] py-4">
                    {pathData.stats.map((stat) => (
                      <div key={stat.label} className="px-3 first:pl-0 last:pr-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a938f]">
                          {stat.label}
                        </p>
                        <p className="mt-1 text-sm font-bold text-[#18211f]">{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 space-y-6">
                    <FeatureList items={pathData.highlights} tone={path} />
                    <RequirementsList items={pathData.requirements} />
                  </div>

                  <button
                    onClick={() => router.push(pathData.href)}
                    className={`mt-7 inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-4 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 ${pathData.buttonClass}`}
                  >
                    {pathData.cta}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="gsap-card overflow-hidden rounded-lg border border-[#153f3b] bg-[#12312e] text-white shadow-lg shadow-[#12312e]/15">
            <div className="grid gap-6 px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex min-w-0 items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/10 text-[#83ddd3]">
                  <ShieldCheck className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#83ddd3]">
                    Existing Pasakay drivers
                  </p>
                  <h2 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">
                    Manage your driver membership
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
                    Sign in to activate, renew, or upgrade your membership through secure PayMongo QR Ph payment.
                  </p>
                </div>
              </div>

              <a
                href="https://registration-pasakay.vercel.app/driver-membership"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-bold text-[#12312e] transition hover:-translate-y-0.5 hover:bg-[#e8f4f2] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#83ddd3] lg:w-auto"
              >
                Driver Membership
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="gsap-card grid gap-5 rounded-lg border border-[#dfe5e1] bg-white p-5 shadow-sm sm:grid-cols-3 sm:p-6">
            <div className="flex items-start gap-3">
              <MapPin className="mt-1 h-5 w-5 text-[#1f6f68]" />
              <div>
                <h3 className="text-sm font-bold text-[#18211f]">Local coverage</h3>
                <p className="mt-1 text-sm leading-6 text-[#66736f]">
                  Better for partners who serve nearby riders and customers.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileCheck className="mt-1 h-5 w-5 text-[#a46312]" />
              <div>
                <h3 className="text-sm font-bold text-[#18211f]">Review-ready documents</h3>
                <p className="mt-1 text-sm leading-6 text-[#66736f]">
                  Gather licenses, permits, and business details before admin review.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Smartphone className="mt-1 h-5 w-5 text-[#1f6f68]" />
              <div>
                <h3 className="text-sm font-bold text-[#18211f]">Mobile-ready work</h3>
                <p className="mt-1 text-sm leading-6 text-[#66736f]">
                  Keep trips, orders, and partner updates close on Android and iOS.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
