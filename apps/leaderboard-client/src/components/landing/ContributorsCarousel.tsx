"use client";

import Image from "next/image";

import type { CommunityMember } from "@/content/community";
import { useDragMarquee } from "@/lib/useDragMarquee";

// Porté de la landing MyTwin Health (`/patients`) : défilement continu, que
// l'on peut attraper et lancer (`useDragMarquee`). Décoratif : la liste lisible
// est à côté.
export function ContributorsCarousel({ items }: { items: ReadonlyArray<CommunityMember> }) {
  const { trackRef, dragHandlers } = useDragMarquee<HTMLDivElement>();

  return (
    <div aria-hidden className="l-carousel" {...dragHandlers}>
      <div ref={trackRef} className="l-carousel__track">
        {[0, 1].map((cycle) =>
          items.map((item, index) => (
            <div key={`${cycle}-${item.name}-${index}`} className="l-person">
              <div className="l-person__photo">
                <Image
                  src={`/landing/contributors/${item.photo}`}
                  alt=""
                  width={84}
                  height={84}
                  draggable={false}
                  loading="lazy"
                />
                <Image
                  className="l-person__flag"
                  src={`/landing/flags/${item.country}.png`}
                  alt=""
                  width={40}
                  height={30}
                  draggable={false}
                  loading="lazy"
                />
              </div>
              <div>
                <p className="l-person__name">{item.name}</p>
                <p className="l-person__role">{item.role}</p>
              </div>
            </div>
          )),
        )}
      </div>
    </div>
  );
}
