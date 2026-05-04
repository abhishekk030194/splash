export const metadata = {
  title: 'Privacy Policy — Nook',
}

const EFFECTIVE_DATE = '20 April 2026'
const BUSINESS_NAME  = 'Nook'
const CONTACT_EMAIL  = 'abhishekk030194@gmail.com'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-5 py-10">

        {/* Header */}
        <div className="mb-8">
          <div className="text-3xl mb-2">🍱</div>
          <h1 className="text-2xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {BUSINESS_NAME} · Effective {EFFECTIVE_DATE}
          </p>
        </div>

        <div className="space-y-8 text-sm text-gray-700 leading-relaxed">

          {/* Intro */}
          <Section>
            <p>
              {BUSINESS_NAME} ("we", "our", "the platform") is a home kitchen marketplace that
              connects buyers with home-based food sellers. This Privacy Policy explains what
              personal data we collect, why we collect it, and your rights over it.
            </p>
            <p className="mt-3">
              This policy is compliant with the <strong>Digital Personal Data Protection (DPDP)
              Act, 2023</strong> of India. By using Nook, you consent to the practices
              described here.
            </p>
          </Section>

          {/* 1 */}
          <Section title="1. Data we collect">
            <Table rows={[
              ['Name',              'Provided during sign-up or at checkout'],
              ['Email address',     'Via Google sign-in'],
              ['Phone number',      'Provided during checkout for delivery contact'],
              ['Delivery address',  'Flat, floor, building, area, landmark — entered at checkout'],
              ['Location (lat/lng)','Detected from your device to show nearby kitchens (optional)'],
              ['Order history',     'Items ordered, amounts, timestamps, order status'],
              ['Payment status',    'Whether payment was completed (we do not store card or UPI details)'],
              ['Device/session',    'Standard web session cookies managed by Supabase Auth'],
            ]} />
            <p className="mt-3 text-xs text-muted-foreground">
              We do not collect payment card numbers, CVVs, or UPI PINs. All payment processing
              is handled by Razorpay, which is PCI-DSS compliant.
            </p>
          </Section>

          {/* 2 */}
          <Section title="2. Why we collect it">
            <Table rows={[
              ['Name, phone, address',  'To deliver your order to the right place and person'],
              ['Email',                 'To identify your account and send order confirmations'],
              ['Location',              'To show you kitchens near you (never stored without consent)'],
              ['Order history',         'To display past orders, handle disputes, and improve the service'],
              ['Payment status',        'To confirm orders and settle payments with sellers'],
            ]} />
          </Section>

          {/* 3 */}
          <Section title="3. Who we share your data with">
            <p className="mb-3">We share your data only where necessary:</p>
            <ul className="space-y-2 list-none">
              <Li><strong>Sellers (home kitchens)</strong> — receive your name, phone, and
                delivery address for orders placed with them. They see nothing beyond what is
                needed to fulfil your order.</Li>
              <Li><strong>Razorpay</strong> — receives your name and email to process UPI
                payments. Razorpay's own privacy policy governs how they handle this data.</Li>
              <Li><strong>Nominatim / OpenStreetMap</strong> — your typed location search query
                is sent to the OpenStreetMap geocoding service to find address suggestions. No
                account or identity data is sent.</Li>
              <Li><strong>Supabase</strong> — our database and authentication provider stores
                your data on servers in their cloud infrastructure.</Li>
            </ul>
            <p className="mt-3">
              We do <strong>not</strong> sell your personal data to any third party, ever.
            </p>
          </Section>

          {/* 4 */}
          <Section title="4. How long we keep your data">
            <Table rows={[
              ['Account data (name, email)',  'Until you request deletion'],
              ['Order history',               '3 years (for dispute resolution and GST records)'],
              ['Delivery addresses',          'Until you delete them or request account deletion'],
              ['Session tokens',              'Expire automatically after 7 days of inactivity'],
            ]} />
          </Section>

          {/* 5 */}
          <Section title="5. Your rights (DPDP Act 2023)">
            <p className="mb-3">As a data principal under the DPDP Act, you have the right to:</p>
            <ul className="space-y-2 list-none">
              <Li><strong>Access</strong> — ask us what personal data we hold about you.</Li>
              <Li><strong>Correction</strong> — ask us to correct inaccurate data.</Li>
              <Li><strong>Erasure</strong> — ask us to delete your personal data. We will comply
                within 30 days, subject to legal retention requirements (e.g. order records).</Li>
              <Li><strong>Withdraw consent</strong> — you can stop using the platform at any
                time. This does not affect lawfulness of processing before withdrawal.</Li>
              <Li><strong>Nominate</strong> — you may nominate another person to exercise these
                rights on your behalf in the event of your death or incapacity.</Li>
            </ul>
            <p className="mt-3">
              To exercise any right, email us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-emerald-800 underline">
                {CONTACT_EMAIL}
              </a>
              . We will respond within <strong>30 days</strong>.
            </p>
          </Section>

          {/* 6 */}
          <Section title="6. Data security">
            <p>
              We use the following measures to protect your data:
            </p>
            <ul className="mt-2 space-y-1 list-none">
              <Li>All data is transmitted over HTTPS (TLS encryption).</Li>
              <Li>Database access is protected by Row Level Security (RLS) — each user can
                only access their own data.</Li>
              <Li>Authentication is handled by Supabase Auth using Google OAuth — we never
                store passwords.</Li>
              <Li>Payment data is never stored on our servers — Razorpay handles all sensitive
                payment information.</Li>
            </ul>
          </Section>

          {/* 7 */}
          <Section title="7. Cookies and local storage">
            <p>
              We use browser <strong>local storage</strong> to save your cart between sessions.
              This data stays on your device and is not transmitted to our servers until you
              place an order. We use session cookies set by Supabase Auth to keep you logged in.
              We do not use advertising or tracking cookies.
            </p>
          </Section>

          {/* 8 */}
          <Section title="8. Children's privacy">
            <p>
              Nook is not intended for use by persons under the age of 18. We do not
              knowingly collect data from minors. If you believe a minor has provided us
              data, please contact us and we will delete it promptly.
            </p>
          </Section>

          {/* 9 */}
          <Section title="9. Changes to this policy">
            <p>
              We may update this policy from time to time. When we do, we will update the
              effective date at the top. Continued use of Nook after changes constitutes
              acceptance of the updated policy. For significant changes, we will notify you
              via the app.
            </p>
          </Section>

          {/* 10 */}
          <Section title="10. Grievance officer">
            <p>
              In accordance with the DPDP Act 2023 and applicable rules, the details of the
              Grievance Officer are:
            </p>
            <div className="mt-3 bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-1">
              <p><strong>Name:</strong> {BUSINESS_NAME} Support</p>
              <p><strong>Platform:</strong> {BUSINESS_NAME} — Home Kitchen Marketplace</p>
              <p><strong>Location:</strong> Bengaluru, India</p>
              <p>
                <strong>Email:</strong>{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-emerald-800 underline">
                  {CONTACT_EMAIL}
                </a>
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Grievances will be acknowledged within 48 hours and resolved within 30 days.
              </p>
            </div>
          </Section>

        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t text-xs text-muted-foreground text-center">
          &copy; {new Date().getFullYear()} {BUSINESS_NAME}. All rights reserved.
        </div>

      </div>
    </div>
  )
}

/* ── Small layout helpers ──────────────────────────────────── */

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section>
      {title && <h2 className="text-base font-semibold text-gray-900 mb-3">{title}</h2>}
      {children}
    </section>
  )
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
      <span>{children}</span>
    </li>
  )
}

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, value], i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-2.5 font-medium text-gray-800 w-2/5 align-top">{label}</td>
              <td className="px-4 py-2.5 text-gray-600 align-top">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
