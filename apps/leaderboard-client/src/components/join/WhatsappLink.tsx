"use client";

import { useRouter } from "next/navigation";

import { markWhatsappJoined } from "@/app/join/actions";
import { WHATSAPP_COMMUNITY_URL } from "@/lib/join";

/**
 * Le lien vers la communauté WhatsApp. Il s'ouvre dans un nouvel onglet ; au
 * même moment, le pas se coche et la page de bienvenue se redessine, pour que
 * le membre la retrouve à jour en revenant sur l'onglet.
 */
export function WhatsappLink({
  className,
  quiet,
  children,
}: {
  className: string;
  quiet: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const onClick = async () => {
    await markWhatsappJoined();
    router.refresh();
  };

  return (
    <a
      href={WHATSAPP_COMMUNITY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      data-quiet={quiet}
      onClick={onClick}
    >
      {children}
    </a>
  );
}
