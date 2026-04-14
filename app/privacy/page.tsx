export default function PrivacyPolicyPage() {
  const updatedAt = 'January 29, 2026';

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold text-gray-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: {updatedAt}</p>

        <section className="mt-8 space-y-4 text-gray-700">
          <p>
            This Privacy Policy explains how PaSakay (&#34;we&#34;, &#34;our&#34;, or &#34;us&#34;)
            collects, uses, shares, and protects your information when you use our
            mobile applications, websites, and related services (the &#34;Services&#34;).
          </p>
          <p>
            By using the Services, you agree to the collection and use of information
            in accordance with this Privacy Policy.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">Information We Collect</h2>
          <ul className="list-disc space-y-2 pl-6 text-gray-700">
            <li>
              <strong>Account information</strong>: name, email address, phone number,
              and login credentials.
            </li>
            <li>
              <strong>Location data</strong>: precise and approximate location collected
              from your device to enable trip matching, navigation, pickup/delivery
              tracking, ETA updates, and safety features. Location data is collected
              while the app is in use.
            </li>
            <li>
              <strong>Transaction data</strong>: trip or delivery details, order items,
              fare or fee amounts, payment status, and receipts.
            </li>
            <li>
              <strong>Driver or merchant verification</strong>: photos and documents
              (e.g., IDs, licenses, permits) you submit for verification.
            </li>
            <li>
              <strong>Usage data</strong>: app interactions, device information, crash
              logs, and performance data.
            </li>
          </ul>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">How We Use Information</h2>
          <ul className="list-disc space-y-2 pl-6 text-gray-700">
            <li>Provide and improve the Services (trips, deliveries, and tracking).</li>
            <li>Match passengers with drivers and merchants with customers.</li>
            <li>Calculate fares, fees, earnings, and commissions.</li>
            <li>Verify accounts and prevent fraud or abuse.</li>
            <li>Communicate with you about your account or support requests.</li>
          </ul>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">How We Share Information</h2>
          <p className="text-gray-700">
            We share information only as needed to operate the Services, including with:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-gray-700">
            <li>
              <strong>Other users</strong>: we share necessary trip or delivery details
              (including location) between passengers, drivers, and merchants to
              complete a service.
            </li>
            <li>
              <strong>Service providers</strong>: such as hosting, analytics, maps, and
              messaging services (e.g., Google Maps, Firebase) to power the app.
            </li>
            <li>
              <strong>Legal requirements</strong>: when required by law or to protect
              safety, rights, or property.
            </li>
          </ul>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">Data Retention</h2>
          <p className="text-gray-700">
            We retain information for as long as needed to provide the Services and to
            comply with legal, accounting, or reporting obligations.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">Security</h2>
          <p className="text-gray-700">
            We use reasonable safeguards to protect your data, but no method of
            transmission or storage is 100% secure.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">Your Choices</h2>
          <ul className="list-disc space-y-2 pl-6 text-gray-700">
            <li>You can update your profile information in the app.</li>
            <li>
              You can manage location permissions in your device settings. Some features
              may not work without location access.
            </li>
          </ul>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">Children&#39;s Privacy</h2>
          <p className="text-gray-700">
            The Services are not intended for children under 13. We do not knowingly
            collect personal information from children under 13.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">Contact Us</h2>
          <p className="text-gray-700">
            If you have questions about this Privacy Policy, contact us at
            <span className="font-medium"> pasakayapplication@gmail.com</span>.
          </p>
        </section>
      </div>
    </main>
  );
}
