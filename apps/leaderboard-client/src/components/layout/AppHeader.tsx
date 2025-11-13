import Link from "next/link";
import Image from "next/image";

export function AppHeader() {
  return (
    <header className="mx-auto flex max-w-6xl items-center px-8 pb-6 pt-10">
      <div className="flex-1 flex items-center">
        <Link href="/" className="inline-block text-2xl font-semibold tracking-wide">
          <Image src="/mytwinlab.svg" alt="MyTwin Lab" width={100} height={0} priority />
        </Link>
      </div>
      <h1 className="flex-1 text-center text-xl font-medium text-white/100">Leaderboard</h1>
      <div className="flex-1" aria-hidden="true" />
    </header>
  );
}
