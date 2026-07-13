import Link from "next/link";

export function AdminButton() {
  return (
    <Link
      href="/admin"
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-brandCP/60 transition-colors hover:bg-white/[0.05] hover:text-brandCP/100"
    >
      Admin
    </Link>
  );
}
