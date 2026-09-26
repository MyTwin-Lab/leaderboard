import type { NewsVideo } from "@/content/news/types";
import { videoLanguageNote } from "@/content/news/video";
import { NewsFigure } from "./NewsFigure";
import { NewsVideoPlayer } from "./NewsVideoPlayer";

/**
 * Une vidéo servie par le site, posée dans le texte d'une news : le lecteur
 * (`NewsVideoPlayer`) dans un cadre 16:9, et la légende, où s'ajoutent la
 * langue parlée et celle des sous-titres.
 *
 * Quand la vidéo est le sujet même de la news, elle est plutôt son
 * illustration (`kind: "video"`) : le lecteur passe en tête d'article.
 */
export function NewsVideoEmbed({ video, caption }: { video: NewsVideo; caption?: string }) {
  const fullCaption = [caption, videoLanguageNote(video)].filter(Boolean).join(" ");

  return (
    <NewsFigure caption={fullCaption || undefined}>
      <div className="v-nd-video">
        <NewsVideoPlayer video={video} sizes="(max-width: 768px) 100vw, 44rem" />
      </div>
    </NewsFigure>
  );
}
