import Link from 'next/link';
import { BrandLogo } from './BrandLogo';

export function Footer() {
  return (
    <footer className="border-t border-token bg-elevated">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4 lg:px-8">
        <div>
          <BrandLogo subtitle="Asset Intelligence & Exchange" />
          <p className="mt-4 text-sm leading-relaxed text-secondary-token">
            Give Abandoned Digital Assets a Second Life. AI-powered technical intelligence,
            compliance-first IP verification, and structured commercialization.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-token">
            Platform
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm text-secondary-token">
            <li><Link href="/explore" className="transition hover:text-primary-token">Explore Assets</Link></li>
            <li><Link href="/how-it-works" className="transition hover:text-primary-token">How It Works</Link></li>
            <li><Link href="/for-owners" className="transition hover:text-primary-token">For Asset Owners</Link></li>
            <li><Link href="/for-buyers" className="transition hover:text-primary-token">For Buyers</Link></li>
            <li><Link href="/enterprise" className="transition hover:text-primary-token">Enterprise</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-token">
            Company &amp; Support
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm text-secondary-token">
            <li><Link href="/about" className="transition hover:text-primary-token">About SecondLife</Link></li>
            <li><Link href="/pricing" className="transition hover:text-primary-token">Pricing</Link></li>
            <li><Link href="/faq" className="transition hover:text-primary-token">FAQ</Link></li>
            <li><Link href="/contact" className="transition hover:text-primary-token">Contact</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-token">
            Trust &amp; Governance
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm text-secondary-token">
            <li><Link href="/terms" className="transition hover:text-primary-token">Terms and Conditions</Link></li>
            <li><Link href="/privacy" className="transition hover:text-primary-token">Privacy Policy</Link></li>
            <li className="pt-2 text-xs leading-relaxed text-muted-token">
              Marketplace listings require verified ownership declarations, license screening, and
              static security evaluation.
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-token px-4 py-5 text-center text-xs text-muted-token">
        © {new Date().getFullYear()} SecondLife Digital Asset Commercialization Platform.
      </div>
    </footer>
  );
}
