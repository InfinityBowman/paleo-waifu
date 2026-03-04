import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_public/terms')({
  component: TermsOfService,
  head: () => ({
    meta: [
      { title: 'Terms of Service | PaleoWaifu' },
      {
        name: 'description',
        content: 'Terms of service for PaleoWaifu',
      },
    ],
  }),
})

function TermsOfService() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <h1 className="font-display text-3xl font-light text-heading sm:text-4xl">
        Terms of Service
      </h1>
      <p className="mt-2 text-xs text-lavender/40">
        Effective March 3, 2026
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-lavender-light/70">
        <section>
          <h2 className="mb-3 text-base font-medium text-heading">
            Agreement to Terms
          </h2>
          <p>
            By accessing or using PaleoWaifu (the &ldquo;Service&rdquo;),
            operated by Syntch LLC, you agree to be bound by these Terms of
            Service. If you do not agree to these terms, do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-medium text-heading">
            The Service
          </h2>
          <p>
            PaleoWaifu is a free-to-play gacha game featuring prehistoric animal
            characters. The Service includes the website at paleowaifu.com and
            the PaleoWaifu Discord bot. The Service allows you to collect
            creatures, trade with other users, earn experience, and participate
            in leaderboards.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-medium text-heading">
            Account and Access
          </h2>
          <ul className="list-inside list-disc space-y-1 text-lavender-light/60">
            <li>
              You must sign in with a valid Discord account to access game
              features
            </li>
            <li>
              You are responsible for maintaining the security of your Discord
              account
            </li>
            <li>You must be at least 13 years old to use the Service</li>
            <li>
              One account per person; multi-accounting to gain unfair advantage
              is prohibited
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-base font-medium text-heading">
            Virtual Items and Currency
          </h2>
          <p>
            Fossils, creatures, and other in-game items are virtual items with
            no real-world monetary value. They are licensed to you, not sold. We
            reserve the right to modify, rebalance, or remove virtual items at
            any time for game balance or other reasons. You may not sell, trade,
            or transfer virtual items for real-world currency or value outside
            the Service.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-medium text-heading">
            Donations
          </h2>
          <p>
            PaleoWaifu is free to play. Voluntary donations via Ko-fi are
            appreciated but do not grant any in-game advantages, items, or
            special status. Donations are non-refundable.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-medium text-heading">
            Acceptable Use
          </h2>
          <p>You agree not to:</p>
          <ul className="list-inside list-disc space-y-1 text-lavender-light/60">
            <li>
              Use bots, scripts, or automated tools to interact with the Service
            </li>
            <li>
              Exploit bugs or vulnerabilities instead of reporting them
            </li>
            <li>
              Attempt to access other users&apos; accounts or data
            </li>
            <li>
              Interfere with or disrupt the Service or its infrastructure
            </li>
            <li>
              Use the Service for any unlawful purpose
            </li>
            <li>
              Harass, abuse, or harm other users through the trading system or
              any other feature
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-base font-medium text-heading">
            Intellectual Property
          </h2>
          <p>
            All content on PaleoWaifu, including creature artwork, character
            designs, game mechanics, and website design, is owned by Syntch LLC
            or its licensors. You may not reproduce, distribute, or create
            derivative works from our content without written permission.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-medium text-heading">
            Termination
          </h2>
          <p>
            We may suspend or terminate your access to the Service at any time,
            with or without cause, including for violation of these terms. You
            may stop using the Service at any time. Upon termination, your
            license to use the Service ends and we may delete your game data
            after a reasonable period.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-medium text-heading">
            Disclaimer of Warranties
          </h2>
          <p>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as
            available&rdquo; without warranties of any kind, express or implied.
            We do not guarantee that the Service will be uninterrupted,
            error-free, or free of harmful components. We are not responsible
            for any loss of game data, virtual items, or progress.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-medium text-heading">
            Limitation of Liability
          </h2>
          <p>
            To the maximum extent permitted by law, Syntch LLC shall not be
            liable for any indirect, incidental, special, consequential, or
            punitive damages arising from your use of the Service. Our total
            liability for any claim arising from the Service shall not exceed
            the amount you have paid us in the 12 months preceding the claim
            (which, for a free service, is zero).
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-medium text-heading">
            Changes to These Terms
          </h2>
          <p>
            We may update these terms from time to time. Changes will be posted
            on this page with an updated effective date. Continued use of the
            Service after changes constitutes acceptance of the revised terms.
            For material changes, we will make reasonable efforts to notify
            users.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-medium text-heading">
            Governing Law
          </h2>
          <p>
            These terms are governed by the laws of the State of Delaware,
            without regard to conflict of law principles.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-medium text-heading">
            Contact Us
          </h2>
          <p>
            If you have questions about these terms, please contact us at{' '}
            <a
              href="mailto:privacy@jacobmaynard.dev"
              className="text-primary/60 hover:text-primary/80"
            >
              privacy@jacobmaynard.dev
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  )
}
