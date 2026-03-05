import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_public/privacy')({
  component: PrivacyPolicy,
  head: () => ({
    meta: [
      { title: 'Privacy Policy | PaleoWaifu' },
      {
        name: 'description',
        content: 'Privacy policy for PaleoWaifu',
      },
    ],
  }),
})

function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <h1 className="font-display text-3xl font-light text-heading sm:text-4xl">
        Privacy Policy
      </h1>
      <p className="mt-2 text-xs text-lavender/40">
        Effective March 3, 2026
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-lavender-light/70">
        <section>
          <h2 className="mb-3 text-base font-medium text-heading">
            Who We Are
          </h2>
          <p>
            PaleoWaifu is operated by Syntch LLC. This privacy policy explains
            how we collect, use, and protect your personal information when you
            use our website at paleowaifu.com and our Discord bot.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-medium text-heading">
            Information We Collect
          </h2>
          <p className="mb-3">
            When you sign in with Discord, we receive and store the following
            information from your Discord account:
          </p>
          <ul className="list-inside list-disc space-y-1 text-lavender-light/60">
            <li>Discord username and display name</li>
            <li>Discord user ID</li>
            <li>Avatar image URL</li>
            <li>Email address (used for account identification only)</li>
          </ul>
          <p className="mt-3">We also collect:</p>
          <ul className="list-inside list-disc space-y-1 text-lavender-light/60">
            <li>
              Game data you generate through play (collection, trades, pull
              history, currency, XP, and level)
            </li>
            <li>
              Discord messages eligible for XP (message content is not stored;
              only the event is used to award XP)
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-base font-medium text-heading">
            How We Use Your Information
          </h2>
          <ul className="list-inside list-disc space-y-1 text-lavender-light/60">
            <li>To authenticate your account and maintain your session</li>
            <li>To provide game functionality (gacha pulls, trading, leaderboards)</li>
            <li>To display your profile on public leaderboards</li>
            <li>To improve and maintain the service</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-base font-medium text-heading">
            Analytics
          </h2>
          <p>
            We use self-hosted Plausible Analytics, a privacy-friendly analytics
            tool that does not use cookies and does not collect personal data.
            We also use Cloudflare, which may collect basic request-level data
            (IP address, request headers) for security and performance purposes
            in accordance with{' '}
            <a
              href="https://www.cloudflare.com/privacypolicy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary/60 hover:text-primary/80"
            >
              Cloudflare&apos;s Privacy Policy
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-medium text-heading">
            Third-Party Services
          </h2>
          <p>We use the following third-party services:</p>
          <ul className="list-inside list-disc space-y-1 text-lavender-light/60">
            <li>
              <span className="text-lavender-light/70">Discord</span> — for
              authentication (OAuth2) and bot interactions
            </li>
            <li>
              <span className="text-lavender-light/70">Cloudflare</span> — for
              hosting, CDN, database, and security
            </li>
            <li>
              <span className="text-lavender-light/70">Ko-fi / Stripe</span> —
              if you choose to make a voluntary donation (we do not store your
              payment information; it is handled entirely by Stripe)
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-base font-medium text-heading">
            Data Storage and Security
          </h2>
          <p>
            Your data is stored in Cloudflare D1 databases and served over
            HTTPS. We use industry-standard security measures including
            encrypted connections, secure session management, and access
            controls. Creature images are stored in Cloudflare R2 object
            storage.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-medium text-heading">
            Data Retention and Deletion
          </h2>
          <p>
            We retain your account and game data for as long as your account is
            active. If you wish to have your data deleted, please contact us at{' '}
            <a
              href="mailto:privacy@paleowaifu.com"
              className="text-primary/60 hover:text-primary/80"
            >
              privacy@paleowaifu.com
            </a>{' '}
            and we will remove your personal data within 30 days.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-medium text-heading">
            Children&apos;s Privacy
          </h2>
          <p>
            PaleoWaifu is not directed at children under 13. We do not knowingly
            collect personal information from children under 13. If you believe
            a child under 13 has provided us with personal information, please
            contact us and we will delete it.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-medium text-heading">
            Your Rights
          </h2>
          <p>You have the right to:</p>
          <ul className="list-inside list-disc space-y-1 text-lavender-light/60">
            <li>Request access to the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Withdraw consent by disconnecting your Discord account</li>
          </ul>
          <p className="mt-3">
            If you are a resident of the EU, you have additional rights under
            the GDPR including data portability and the right to lodge a
            complaint with a supervisory authority. California residents have
            rights under the CCPA to know what data is collected and to request
            its deletion.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-medium text-heading">
            Changes to This Policy
          </h2>
          <p>
            We may update this privacy policy from time to time. Changes will be
            posted on this page with an updated effective date. Continued use of
            the service after changes constitutes acceptance of the revised
            policy.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-medium text-heading">
            Contact Us
          </h2>
          <p>
            If you have questions about this privacy policy or your data, please
            contact us at{' '}
            <a
              href="mailto:privacy@paleowaifu.com"
              className="text-primary/60 hover:text-primary/80"
            >
              privacy@paleowaifu.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  )
}
