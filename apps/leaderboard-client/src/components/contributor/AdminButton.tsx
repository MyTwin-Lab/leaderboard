import Link from "next/link";

export function AdminButton() {
  return (
    <Link
      href="/admin"
      className="rounded-xl bg-brandCP/20 border border-brandCP/40 shadow-md px-3 text-sm py-2 text-center text-brandCP transition hover:bg-brandCP/30 font-semibold"
    >
      Admin
    </Link>
  );
}
