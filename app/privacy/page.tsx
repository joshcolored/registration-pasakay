export default function PrivacyPolicyPage() {
  const updatedAt = 'January 29, 2026';

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold text-gray-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: {updatedAt}</p>

            <section className="mt-8 space-y-4 text-gray-700">
      <p>
        This Privacy Policy explains how PaSakay (&quot;we&quot;, &quot;our&quot;, or
        &quot;us&quot;) collects, uses, shares, retains, and protects your information
        when you use our mobile applications, websites, and related services
        (the &quot;Services&quot;).
      </p>

      <p>
        By using the Services, you agree to the collection and use of information
        in accordance with this Privacy Policy.
      </p>

      <p>
        PaSakay provides transport, delivery, merchant, and related booking services.
        Some features require account information, location access, and transaction
        details to operate properly.
      </p>
    </section>

    <section className="mt-10 space-y-3">
      <h2 className="text-xl font-semibold text-gray-900">Developer Information</h2>
      <p className="text-gray-700">
        App name: <span className="font-medium">PaSakay</span>
      </p>
      <p className="text-gray-700">
        Developer/Operator: <span className="font-medium">PaSakay Application Team</span>
      </p>
      <p className="text-gray-700">
        Contact email:{' '}
        <a
          href="mailto:pasakayapplication@gmail.com"
          className="font-medium text-blue-600 underline"
        >
          pasakayapplication@gmail.com
        </a>
      </p>
    </section>

    <section className="mt-10 space-y-3">
      <h2 className="text-xl font-semibold text-gray-900">Information We Collect</h2>

      <p className="text-gray-700">
        We may collect the following types of information depending on how you use
        the Services:
      </p>

      <ul className="list-disc space-y-2 pl-6 text-gray-700">
        <li>
          <strong>Account information:</strong> name, email address, phone number,
          account role, profile details, and login credentials or authentication
          information.
        </li>

        <li>
          <strong>Location data:</strong> precise and approximate location from your
          device to enable pickup and drop-off selection, trip matching, delivery
          tracking, route display, navigation, estimated arrival times, and safety
          features. Location data is collected while the app is in use.
        </li>

        <li>
          <strong>Trip, booking, and delivery information:</strong> pickup and
          drop-off locations, booking history, order details, delivery status,
          driver assignment, merchant details, timestamps, and service records.
        </li>

        <li>
          <strong>Transaction information:</strong> fare or fee amounts, payment
          status, receipts, refunds, commissions, earnings, and related transaction
          records. We do not store full card numbers unless a payment provider
          separately requires and handles them.
        </li>

        <li>
          <strong>Driver or merchant verification information:</strong> photos,
          identification documents, licenses, permits, vehicle information, business
          information, or other documents submitted for verification.
        </li>

        <li>
          <strong>Photos, files, or media you submit:</strong> images or documents
          uploaded for profile, verification, order, delivery, support, or reporting
          purposes.
        </li>

        <li>
          <strong>Device and usage information:</strong> device model, operating
          system, app version, device identifiers, IP address, crash logs,
          diagnostics, performance data, and how you interact with the app.
        </li>

        <li>
          <strong>Support and communication information:</strong> messages, reports,
          feedback, complaints, and other information you send to us for customer
          support or service improvement.
        </li>
      </ul>
    </section>

    <section className="mt-10 space-y-3">
      <h2 className="text-xl font-semibold text-gray-900">
        Location Data and Permissions
      </h2>

      <p className="text-gray-700">
        PaSakay uses location data to provide core app features such as pickup and
        drop-off selection, trip matching, delivery tracking, route display,
        navigation, estimated arrival time, and service safety.
      </p>

      <p className="text-gray-700">
        Location data is collected while the app is in use. You can disable location
        access in your device settings, but some features may not work properly
        without location permission.
      </p>

      <p className="text-gray-700">
        If PaSakay adds background location features in the future, we will provide
        a clear in-app disclosure and request your consent before collecting location
        data in the background, as required by applicable platform policies.
      </p>
    </section>

    <section className="mt-10 space-y-3">
      <h2 className="text-xl font-semibold text-gray-900">How We Use Information</h2>

      <ul className="list-disc space-y-2 pl-6 text-gray-700">
        <li>Provide, operate, and improve the Services.</li>
        <li>Create, manage, authenticate, and protect user accounts.</li>
        <li>Match passengers with drivers and customers with merchants.</li>
        <li>Process bookings, trips, deliveries, orders, and related transactions.</li>
        <li>Display pickup, drop-off, delivery, route, tracking, and ETA information.</li>
        <li>Calculate fares, fees, commissions, earnings, and payment status.</li>
        <li>Verify drivers, merchants, vehicles, and business information.</li>
        <li>Detect, prevent, and respond to fraud, abuse, security issues, or misuse.</li>
        <li>Provide customer support and respond to questions or complaints.</li>
        <li>Send important service updates, account notices, and operational messages.</li>
        <li>Analyze app performance, fix errors, and improve user experience.</li>
        <li>Comply with legal, regulatory, accounting, tax, or safety obligations.</li>
      </ul>
    </section>

    <section className="mt-10 space-y-3">
      <h2 className="text-xl font-semibold text-gray-900">
        How We Share Information
      </h2>

      <p className="text-gray-700">
        We do not sell your personal information. We only share information when
        needed to provide the Services, protect users, comply with law, or operate
        our platform.
      </p>

      <ul className="list-disc space-y-2 pl-6 text-gray-700">
        <li>
          <strong>Passengers, drivers, merchants, and customers:</strong> we share
          necessary service details such as name, pickup/drop-off details, order
          details, location, contact information, and trip or delivery status so
          users can complete bookings, trips, orders, or deliveries.
        </li>

        <li>
          <strong>Service providers:</strong> we may share data with trusted vendors
          that help us operate the Services, such as hosting, authentication,
          database, cloud storage, analytics, crash reporting, maps, notifications,
          and messaging providers.
        </li>

        <li>
          <strong>Payment providers:</strong> if payments are enabled, payment-related
          information may be processed by third-party payment processors to complete
          transactions, refunds, payouts, or fraud checks.
        </li>

        <li>
          <strong>Legal and safety reasons:</strong> we may disclose information if
          required by law, legal process, government request, or when necessary to
          protect users, prevent fraud, enforce our terms, or protect our rights,
          property, and safety.
        </li>

        <li>
          <strong>Business transfers:</strong> if PaSakay is involved in a merger,
          acquisition, restructuring, or sale of assets, user information may be
          transferred as part of that transaction, subject to this Privacy Policy.
        </li>
      </ul>
    </section>

    <section className="mt-10 space-y-3">
      <h2 className="text-xl font-semibold text-gray-900">
        Third-Party Services We May Use
      </h2>

      <p className="text-gray-700">
        PaSakay may use third-party services to support app functionality. These
        services may process data according to their own privacy policies and service
        terms.
      </p>

      <ul className="list-disc space-y-2 pl-6 text-gray-700">
        <li>
          <strong>Firebase / Google services:</strong> authentication, database,
          storage, app performance monitoring, crash reporting, notifications, and
          analytics.
        </li>

        <li>
          <strong>Google Maps Platform:</strong> maps, places search, geolocation,
          routing, navigation, pickup/drop-off selection, and location-based features.
        </li>

        <li>
          <strong>Hosting providers:</strong> website hosting, backend hosting,
          server infrastructure, and deployment services.
        </li>

        <li>
          <strong>Payment providers:</strong> payment processing, transaction
          confirmation, fraud prevention, refunds, and payouts, if payment features
          are enabled.
        </li>
      </ul>
    </section>

    <section className="mt-10 space-y-3">
      <h2 className="text-xl font-semibold text-gray-900">Data Security</h2>

      <p className="text-gray-700">
        We use reasonable technical, administrative, and organizational safeguards
        to protect personal information. These safeguards may include HTTPS/TLS
        encryption during transmission, access controls, authentication protections,
        restricted access to user data, monitoring, and security review of our
        systems.
      </p>

      <p className="text-gray-700">
        However, no method of transmission over the internet or electronic storage
        is completely secure. We cannot guarantee absolute security, but we work to
        protect your information and reduce risks.
      </p>
    </section>

    <section className="mt-10 space-y-3">
      <h2 className="text-xl font-semibold text-gray-900">Data Retention</h2>

      <p className="text-gray-700">
        We retain personal information only for as long as reasonably necessary to
        provide the Services, maintain your account, complete transactions, resolve
        disputes, prevent fraud or abuse, enforce our terms, and comply with legal,
        tax, accounting, reporting, and safety obligations.
      </p>

      <p className="text-gray-700">
        Some information may be retained for a longer period if required by law,
        needed for legitimate business records, security, fraud prevention, dispute
        resolution, or compliance purposes. When information is no longer needed, we
        will delete, anonymize, or securely store it according to applicable
        requirements.
      </p>
    </section>

    <section id="account-data-deletion" className="mt-10 space-y-3">
      <h2 className="text-xl font-semibold text-gray-900">
        Account and Data Deletion
      </h2>

      <p className="text-gray-700">
        You may request deletion of your PaSakay account and associated personal
        data by contacting us at{' '}
        <a
          href="mailto:pasakayapplication@gmail.com"
          className="font-medium text-blue-600 underline"
        >
          pasakayapplication@gmail.com
        </a>
        .
      </p>

      <p className="text-gray-700">
        To protect your account, we may ask you to verify your identity before
        processing a deletion request. After verification, we will delete or
        anonymize personal data associated with your account unless we are required
        or permitted to retain certain information for legal, tax, accounting,
        security, fraud prevention, dispute resolution, or service-record purposes.
      </p>

      <p className="text-gray-700">
        You may also delete or update certain information directly in the app when
        those controls are available. If you cannot access your account, you may
        contact us using the email above.
      </p>
    </section>

    <section className="mt-10 space-y-3">
      <h2 className="text-xl font-semibold text-gray-900">Your Choices</h2>

      <ul className="list-disc space-y-2 pl-6 text-gray-700">
        <li>You can update your profile information in the app when available.</li>

        <li>
          You can manage app permissions, including location, camera, photos, files,
          and notifications, through your device settings.
        </li>

        <li>
          You can request access, correction, or deletion of your personal
          information by contacting us.
        </li>

        <li>
          You can stop using the Services and request account deletion if you no
          longer want us to process your account information.
        </li>
      </ul>
    </section>

    <section className="mt-10 space-y-3">
      <h2 className="text-xl font-semibold text-gray-900">Children&apos;s Privacy</h2>

      <p className="text-gray-700">
        The Services are not intended for children under 13 years old. We do not
        knowingly collect personal information from children under 13. If we learn
        that we have collected personal information from a child under 13, we will
        take reasonable steps to delete that information.
      </p>
    </section>

    <section className="mt-10 space-y-3">
      <h2 className="text-xl font-semibold text-gray-900">
        Changes to This Privacy Policy
      </h2>

      <p className="text-gray-700">
        We may update this Privacy Policy from time to time. When we make changes,
        we will update the &quot;Last updated&quot; date at the top of this page. Your
        continued use of the Services after changes are posted means you accept the
        updated Privacy Policy.
      </p>
    </section>

    <section className="mt-10 space-y-3">
      <h2 className="text-xl font-semibold text-gray-900">Contact Us</h2>

      <p className="text-gray-700">
        If you have questions, concerns, or requests about this Privacy Policy or
        your personal data, contact us at{' '}
        <a
          href="mailto:pasakayapplication@gmail.com"
          className="font-medium text-blue-600 underline"
        >
          pasakayapplication@gmail.com
        </a>
        .
      </p>
    </section>
  </div>
</main>
  );
}
