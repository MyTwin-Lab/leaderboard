"use client";

import Image from "next/image";

import type { CommunityMember } from "@/content/community";
import { useDragMarquee } from "@/lib/useDragMarquee";

// Le carousel de la landing, habillé aux couleurs du Lab : même mouvement
// (`useDragMarquee`), mêmes photos. Décoratif : la liste lisible est à côté.
export function HomeCommunityCarousel({ members }: { members: ReadonlyArray<CommunityMember> }) {
  const { trackRef, dragHandlers } = useDragMarquee<HTMLDivElement>();

  return (
    <div
      aria-hidden
      className="w-full cursor-grab touch-pan-y select-none overflow-hidden py-4 [mask-image:linear-gradient(90deg,transparent,#000_9%,#000_91%,transparent)] active:cursor-grabbing"
      {...dragHandlers}
    >
      <div
        ref={trackRef}
        className="flex w-max gap-8 will-change-transform md:grid md:grid-flow-col md:grid-rows-2 md:gap-x-8 md:gap-y-9"
      >
        {[0, 1].map((cycle) =>
          members.map((member, index) => (
            <div key={`${cycle}-${member.name}-${index}`} className="flex w-34 flex-none flex-col items-center gap-3 text-center">
              <div className="relative">
                <Image
                  src={`/landing/contributors/${member.photo}`}
                  alt=""
                  width={84}
                  height={84}
                  draggable={false}
                  loading="lazy"
                  className="pointer-events-none h-21 w-21 rounded-full object-cover"
                />
                <Image
                  src={`/landing/flags/${member.country}.png`}
                  alt=""
                  width={40}
                  height={30}
                  draggable={false}
                  loading="lazy"
                  className="pointer-events-none absolute right-0 bottom-0 h-auto w-5 rounded-[3px] shadow-[0_1px_4px_rgba(0,0,0,0.35)]"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-[15px] font-medium leading-snug text-white">{member.name}</p>
                <p className="text-[13px] leading-snug text-white/50">{member.role}</p>
              </div>
            </div>
          )),
        )}
      </div>
    </div>
  );
}
