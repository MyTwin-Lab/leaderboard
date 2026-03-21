"use client";

export function LogoutButton() {
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/";
      }}
      className="cursor-pointer rounded-xl bg-white/10 px-3 text-sm py-2 text-center text-white transition hover:bg-white/20"
    >
      Sign out
    </button>
  );
}
