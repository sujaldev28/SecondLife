import Link from 'next/link';
import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export function PublicPageLayout({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-app">
      <Navbar />
      <section className="relative overflow-hidden border-b border-token bg-elevated px-4 py-16 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute -top-24 right-1/4 h-72 w-72 rounded-full bg-[#8B5CF6]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-[#22D3EE]/10 blur-3xl" />
        <div className="relative mx-auto max-w-5xl">
          <span className="inline-flex items-center rounded-full border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#A78BFA]">
            {eyebrow}
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-primary-token sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-secondary-token">{subtitle}</p>
        </div>
      </section>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 lg:px-8 animate-sl-in">
        {children}
      </main>
      <div className="border-t border-token bg-elevated px-4 py-10 text-center">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3">
          <p className="text-sm text-secondary-token">
            Ready to evaluate dormant code or source verified technical IP?
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/explore"
              className="sl-gradient-primary inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
            >
              Explore Verified Marketplace
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/register"
              className="rounded-lg border border-token bg-surface px-5 py-2.5 text-sm font-semibold text-primary-token hover:bg-surface-elevated"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
