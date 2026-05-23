import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle,
  FileText,
  Lock,
  Mail,
  MapPin,
  Shield,
  UserCheck,
} from 'lucide-react';

const updatedAt = 'January 29, 2026';

const sections = [
  { id: 'developer', label: 'Developer Information' },
  { id: 'information', label: 'Information We Collect' },
  { id: 'location', label: 'Location Data' },
  { id: 'use', label: 'How We Use Information' },
  { id: 'sharing', label: 'How We Share Information' },
  { id: 'third-party', label: 'Third-Party Services' },
  { id: 'security', label: 'Security' },
  { id: 'retention', label: 'Data Retention' },
  { id: 'deletion', label: 'Account Deletion' },
  { id: 'choices', label: 'Your Choices' },
  { id: 'children', label: "Children's Privacy" },
  { id: 'changes', label: 'Policy Changes' },
  { id: 'contact', label: 'Contact Us' },
];

const summaryCards = [
  {
    icon: MapPin,
    title: 'Location Use',
    description: 'Used for trips, deliveries, tracking, ETA updates, and safety features.',
  },
  {
    icon: UserCheck,
    title: 'Verification',
    description: 'Driver and merchant documents are collected only for account review.',
  },
  {
    icon: Lock,
    title: 'Safeguards',
    description: 'We use reasonable safeguards for account, location, and transaction data.',
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#f7f8f5] text-[#18211f]">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.36]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(31,111,104,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(31,111,104,0.05) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />

      <div className="relative">
        <header className="border-b border-[#dfe5e1] bg-[#f7f8f5]/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <Link
              href="/"
              className="inline-flex items-center gap-3 rounded-md px-2 py-2 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f68]/25"
            >
              <img
                src="/pasakay-logo.jpg"
                alt="Pasakay logo"
                className="h-10 w-10 rounded-md bg-white object-cover shadow-sm"
              />
              <span>
                <span className="block text-base font-bold leading-none tracking-tight">Pasakay</span>
                <span className="mt-1.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-[#66736f]">
                  Privacy Policy
                </span>
              </span>
            </Link>
            <Link
              href="/register"
              className="hidden items-center gap-2 rounded-md border border-[#dfe5e1] bg-white px-3 py-2 text-sm font-semibold text-[#49534f] shadow-sm transition hover:bg-[#edf0eb] hover:text-[#18211f] sm:inline-flex"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to registration
            </Link>
          </div>
        </header>

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="grid gap-8 lg:grid-cols-[1fr_21rem] lg:items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-md border border-[#dfe5e1] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#1f6f68] shadow-sm">
                <Shield className="h-4 w-4" />
                Pasakay data practices
              </div>
              <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
                Privacy Policy
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[#66736f]">
                This page explains how PaSakay collects, uses, shares, retains, and
                protects information across our mobile applications, websites, and
                related services.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <div className="inline-flex items-center gap-2 rounded-md border border-[#dfe5e1] bg-white px-3 py-2 text-sm font-semibold text-[#49534f] shadow-sm">
                  <FileText className="h-4 w-4 text-[#1f6f68]" />
                  Last updated: {updatedAt}
                </div>
                <a
                  href="mailto:pasakayapplication@gmail.com"
                  className="inline-flex items-center gap-2 rounded-md border border-[#dfe5e1] bg-white px-3 py-2 text-sm font-semibold text-[#49534f] shadow-sm transition hover:bg-[#edf0eb] hover:text-[#18211f]"
                >
                  <Mail className="h-4 w-4 text-[#1f6f68]" />
                  pasakayapplication@gmail.com
                </a>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {summaryCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.title}
                      className="rounded-lg border border-[#dfe5e1] bg-white p-5 shadow-sm"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#e8f4f2] text-[#1f6f68]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h2 className="mt-4 text-sm font-bold text-[#18211f]">{card.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-[#66736f]">{card.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="hidden rounded-lg border border-[#dfe5e1] bg-white p-5 shadow-sm lg:block lg:sticky lg:top-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#66736f]">
                On this page
              </p>
              <nav className="mt-4 max-h-[calc(100vh-9rem)] space-y-1 overflow-auto pr-1">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="block rounded-md px-3 py-2 text-sm font-semibold text-[#49534f] transition hover:bg-[#edf0eb] hover:text-[#18211f]"
                  >
                    {section.label}
                  </a>
                ))}
              </nav>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_21rem]">
            <article className="overflow-hidden rounded-lg border border-[#dfe5e1] bg-white shadow-sm">
              <div className="border-b border-[#e5e2d8] bg-[#fbfcf9] px-6 py-5">
                <div className="max-w-3xl space-y-3 text-sm leading-6 text-[#66736f]">
                  <p>
                    By using the Services, you agree to the collection and use of
                    information in accordance with this Privacy Policy.
                  </p>
                  <p>
                    PaSakay provides transport, delivery, merchant, and related
                    booking services. Some features require account information,
                    location access, and transaction details to operate properly.
                  </p>
                </div>
              </div>

              <div className="divide-y divide-[#edf0eb]">
                <PolicySection id="developer" title="Developer Information">
                  <PolicyList
                    items={[
                      {
                        title: 'App name',
                        body: 'PaSakay.',
                      },
                      {
                        title: 'Developer/operator',
                        body: 'PaSakay Application Team.',
                      },
                      {
                        title: 'Contact email',
                        body: 'pasakayapplication@gmail.com.',
                      },
                    ]}
                  />
                </PolicySection>

                <PolicySection id="information" title="Information We Collect">
                  <PolicyParagraph>
                    We may collect the following types of information depending on how
                    you use the Services:
                  </PolicyParagraph>
                  <PolicyList
                    items={[
                      {
                        title: 'Account information',
                        body: 'name, email address, phone number, account role, profile details, and login credentials or authentication information.',
                      },
                      {
                        title: 'Location data',
                        body: 'precise and approximate location from your device to enable pickup and drop-off selection, trip matching, delivery tracking, route display, navigation, ETA updates, and safety features.',
                      },
                      {
                        title: 'Trip, booking, and delivery information',
                        body: 'pickup and drop-off locations, booking history, order details, delivery status, driver assignment, merchant details, timestamps, and service records.',
                      },
                      {
                        title: 'Transaction information',
                        body: 'fare or fee amounts, payment status, receipts, refunds, commissions, earnings, and related transaction records.',
                      },
                      {
                        title: 'Driver or merchant verification',
                        body: 'photos, identification documents, licenses, permits, vehicle information, business information, or other documents submitted for verification.',
                      },
                      {
                        title: 'Submitted media',
                        body: 'images or documents uploaded for profile, verification, order, delivery, support, or reporting purposes.',
                      },
                      {
                        title: 'Device and usage information',
                        body: 'device model, operating system, app version, device identifiers, IP address, crash logs, diagnostics, performance data, and app interactions.',
                      },
                      {
                        title: 'Support and communication information',
                        body: 'messages, reports, feedback, complaints, and other information you send to us for support or service improvement.',
                      },
                    ]}
                  />
                </PolicySection>

                <PolicySection id="location" title="Location Data and Permissions">
                  <PolicyParagraph>
                    PaSakay uses location data to provide core app features such as
                    pickup and drop-off selection, trip matching, delivery tracking,
                    route display, navigation, estimated arrival time, and service safety.
                  </PolicyParagraph>
                  <PolicyParagraph>
                    Location data is collected while the app is in use. You can disable
                    location access in your device settings, but some features may not
                    work properly without location permission.
                  </PolicyParagraph>
                  <PolicyParagraph>
                    If PaSakay adds background location features in the future, we will
                    provide a clear in-app disclosure and request your consent before
                    collecting location data in the background, as required by applicable
                    platform policies.
                  </PolicyParagraph>
                </PolicySection>

                <PolicySection id="use" title="How We Use Information">
                  <ul className="space-y-3">
                    {[
                      'Provide, operate, and improve the Services.',
                      'Create, manage, authenticate, and protect user accounts.',
                      'Match passengers with drivers and customers with merchants.',
                      'Process bookings, trips, deliveries, orders, and related transactions.',
                      'Display pickup, drop-off, delivery, route, tracking, and ETA information.',
                      'Calculate fares, fees, commissions, earnings, and payment status.',
                      'Verify drivers, merchants, vehicles, and business information.',
                      'Detect, prevent, and respond to fraud, abuse, security issues, or misuse.',
                      'Provide customer support and respond to questions or complaints.',
                      'Send important service updates, account notices, and operational messages.',
                      'Analyze app performance, fix errors, and improve user experience.',
                      'Comply with legal, regulatory, accounting, tax, or safety obligations.',
                    ].map((item) => (
                      <PolicyBullet key={item}>{item}</PolicyBullet>
                    ))}
                  </ul>
                </PolicySection>

                <PolicySection id="sharing" title="How We Share Information">
                  <PolicyParagraph>
                    We do not sell your personal information. We only share information
                    when needed to provide the Services, protect users, comply with law,
                    or operate our platform.
                  </PolicyParagraph>
                  <PolicyList
                    items={[
                      {
                        title: 'Passengers, drivers, merchants, and customers',
                        body: 'we share necessary service details such as name, pickup and drop-off details, order details, location, contact information, and trip or delivery status so users can complete services.',
                      },
                      {
                        title: 'Service providers',
                        body: 'we may share data with trusted vendors that help us operate the Services, such as hosting, authentication, database, cloud storage, analytics, crash reporting, maps, notifications, and messaging providers.',
                      },
                      {
                        title: 'Payment providers',
                        body: 'if payments are enabled, payment-related information may be processed by third-party payment processors to complete transactions, refunds, payouts, or fraud checks.',
                      },
                      {
                        title: 'Legal and safety reasons',
                        body: 'we may disclose information if required by law, legal process, government request, or when necessary to protect users, prevent fraud, enforce our terms, or protect our rights, property, and safety.',
                      },
                      {
                        title: 'Business transfers',
                        body: 'if PaSakay is involved in a merger, acquisition, restructuring, or sale of assets, user information may be transferred as part of that transaction, subject to this Privacy Policy.',
                      },
                    ]}
                  />
                </PolicySection>

                <PolicySection id="third-party" title="Third-Party Services We May Use">
                  <PolicyParagraph>
                    PaSakay may use third-party services to support app functionality.
                    These services may process data according to their own privacy
                    policies and service terms.
                  </PolicyParagraph>
                  <PolicyList
                    items={[
                      {
                        title: 'Firebase / Google services',
                        body: 'authentication, database, storage, app performance monitoring, crash reporting, notifications, and analytics.',
                      },
                      {
                        title: 'Google Maps Platform',
                        body: 'maps, places search, geolocation, routing, navigation, pickup/drop-off selection, and location-based features.',
                      },
                      {
                        title: 'Hosting providers',
                        body: 'website hosting, backend hosting, server infrastructure, and deployment services.',
                      },
                      {
                        title: 'Payment providers',
                        body: 'payment processing, transaction confirmation, fraud prevention, refunds, and payouts, if payment features are enabled.',
                      },
                    ]}
                  />
                </PolicySection>

                <PolicySection id="security" title="Data Security">
                  <PolicyParagraph>
                    We use reasonable technical, administrative, and organizational
                    safeguards to protect personal information. These safeguards may
                    include HTTPS/TLS encryption during transmission, access controls,
                    authentication protections, restricted access to user data,
                    monitoring, and security review of our systems.
                  </PolicyParagraph>
                  <PolicyParagraph>
                    However, no method of transmission over the internet or electronic
                    storage is completely secure. We cannot guarantee absolute security,
                    but we work to protect your information and reduce risks.
                  </PolicyParagraph>
                </PolicySection>

                <PolicySection id="retention" title="Data Retention">
                  <PolicyParagraph>
                    We retain personal information only for as long as reasonably
                    necessary to provide the Services, maintain your account, complete
                    transactions, resolve disputes, prevent fraud or abuse, enforce our
                    terms, and comply with legal, tax, accounting, reporting, and safety
                    obligations.
                  </PolicyParagraph>
                  <PolicyParagraph>
                    Some information may be retained for a longer period if required by
                    law, needed for legitimate business records, security, fraud
                    prevention, dispute resolution, or compliance purposes. When
                    information is no longer needed, we will delete, anonymize, or
                    securely store it according to applicable requirements.
                  </PolicyParagraph>
                </PolicySection>

                <PolicySection id="deletion" title="Account and Data Deletion">
                  <PolicyParagraph>
                    You may request deletion of your PaSakay account and associated
                    personal data by contacting us at{' '}
                    <a
                      href="mailto:pasakayapplication@gmail.com"
                      className="font-bold text-[#1f6f68] underline-offset-4 hover:underline"
                    >
                      pasakayapplication@gmail.com
                    </a>
                    .
                  </PolicyParagraph>
                  <PolicyParagraph>
                    To protect your account, we may ask you to verify your identity
                    before processing a deletion request. After verification, we will
                    delete or anonymize personal data associated with your account unless
                    we are required or permitted to retain certain information for legal,
                    tax, accounting, security, fraud prevention, dispute resolution, or
                    service-record purposes.
                  </PolicyParagraph>
                  <PolicyParagraph>
                    You may also delete or update certain information directly in the app
                    when those controls are available. If you cannot access your account,
                    you may contact us using the email above.
                  </PolicyParagraph>
                </PolicySection>

                <PolicySection id="choices" title="Your Choices">
                  <ul className="space-y-3">
                    <PolicyBullet>You can update your profile information in the app when available.</PolicyBullet>
                    <PolicyBullet>
                      You can manage app permissions, including location, camera, photos,
                      files, and notifications, through your device settings.
                    </PolicyBullet>
                    <PolicyBullet>
                      You can request access, correction, or deletion of your personal
                      information by contacting us.
                    </PolicyBullet>
                    <PolicyBullet>
                      You can stop using the Services and request account deletion if
                      you no longer want us to process your account information.
                    </PolicyBullet>
                  </ul>
                </PolicySection>

                <PolicySection id="children" title="Children's Privacy">
                  <PolicyParagraph>
                    The Services are not intended for children under 13 years old. We do
                    not knowingly collect personal information from children under 13. If
                    we learn that we have collected personal information from a child
                    under 13, we will take reasonable steps to delete that information.
                  </PolicyParagraph>
                </PolicySection>

                <PolicySection id="changes" title="Changes to This Privacy Policy">
                  <PolicyParagraph>
                    We may update this Privacy Policy from time to time. When we make
                    changes, we will update the Last updated date at the top of this
                    page. Your continued use of the Services after changes are posted
                    means you accept the updated Privacy Policy.
                  </PolicyParagraph>
                </PolicySection>

                <PolicySection id="contact" title="Contact Us">
                  <PolicyParagraph>
                    If you have questions about this Privacy Policy, contact us at{' '}
                    <a
                      href="mailto:pasakayapplication@gmail.com"
                      className="font-bold text-[#1f6f68] underline-offset-4 hover:underline"
                    >
                      pasakayapplication@gmail.com
                    </a>
                    .
                  </PolicyParagraph>
                </PolicySection>
              </div>
            </article>

            <div className="hidden lg:block" />
          </div>
        </section>
      </div>
    </main>
  );
}

function PolicySection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8 px-6 py-7">
      <h2 className="text-xl font-bold tracking-tight text-[#18211f]">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function PolicyParagraph({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-6 text-[#66736f]">{children}</p>;
}

function PolicyList({
  items,
}: {
  items: { title: string; body: string }[];
}) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <PolicyBullet key={item.title}>
          <strong className="font-bold text-[#18211f]">{item.title}</strong>: {item.body}
        </PolicyBullet>
      ))}
    </ul>
  );
}

function PolicyBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm leading-6 text-[#66736f]">
      <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#1f6f68]" />
      <span>{children}</span>
    </li>
  );
}
