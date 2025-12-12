import Link from "next/link";
import Image from "next/image";

import { ContributorBadge } from "@/components/contributor/ContributorBadge";
import { fetchContributorSession } from "@/lib/contributor";
import { Navigation } from "./Navigation";

export async function AppHeader() {
  const session = await fetchContributorSession();

  return (
    <header className="mx-auto flex max-w-6xl items-center px-8 pb-6 pt-10">
      <div className="flex flex-1 items-center">
        <Link href="/" className="inline-block text-2xl font-semibold tracking-wide">
          <Image src="/mytwinlab.svg" alt="MyTwin Lab" width={100} height={0} priority />
        </Link>
      </div>
      <Navigation />
      <div className="flex flex-1 items-center justify-end opacity-0">
        {session ? (
          <ContributorBadge fullName={session.fullName} githubUsername={session.githubUsername} role={session.role} />
        ) : (
          <Link
            href="/login?from=/contributors/me"
            className="rounded-full bg-white/5 px-4 py-2 text-m font-medium text-brandCP/90 shadow-md shadow-black/20 transition hover:bg-white/10"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
