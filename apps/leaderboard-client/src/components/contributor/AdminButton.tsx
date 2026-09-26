import Link from "next/link";

/** Le bouclier de la maquette : la gélule pleine, à côté du « Log out ». */
export function AdminButton() {
  return (
    <Link href="/admin" className="v-pro-btn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
      Admin
    </Link>
  );
}
