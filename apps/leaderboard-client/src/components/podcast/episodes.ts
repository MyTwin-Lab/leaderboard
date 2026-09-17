import type { StaticImageData } from "next/image";
import thumbnailHeart from "../../../public/podcast/miniature_mytwin_inside_ensweet.webp";
import thumbnailVoice from "../../../public/podcast/miniature_mytwin_inside_virtuosis_ai.webp";
import thumbnailFace from "../../../public/podcast/miniature_mytwin_inside_i-virtual.webp";
import thumbnailRecords from "../../../public/podcast/miniature_mytwin_inside_healthguard.webp";

/**
 * Les épisodes de MyTwin Inside, le programme de la chaîne YouTube MyTwin.
 * Mêmes vidéos, mêmes miniatures et mêmes titres anglais que sur mytwin.care
 * (`podcast-videos.tsx` et `shared.podcast` du repo mytwin-health-landing) :
 * un épisode ajouté là-bas s'ajoute ici.
 *
 * Les miniatures sont embarquées plutôt que lues sur i.ytimg.com : sur
 * mytwin.care, des proxys de réseaux hospitaliers bloquaient toute URL qui
 * désignait YouTube.
 */
export const PODCAST_PLAYLIST_ID = "PLgRcw03K25MJzkQQlFFNu71Cobtboj3JA";
export const PODCAST_PLAYLIST_URL = `https://www.youtube.com/playlist?list=${PODCAST_PLAYLIST_ID}`;

export type PodcastEpisodeKey = "heart" | "voice" | "face" | "records";

export type PodcastEpisode = {
  key: PodcastEpisodeKey;
  youtubeId: string;
  title: string;
  thumbnail: StaticImageData;
};

export const PODCAST_EPISODES: readonly PodcastEpisode[] = [
  {
    key: "heart",
    youtubeId: "VsQTq4K1Jb8",
    title: "Life after a heart attack: the challenge no one talks about",
    thumbnail: thumbnailHeart,
  },
  {
    key: "voice",
    youtubeId: "LA_vw_gmANM",
    title: "This AI analyzes your voice to detect stress, anxiety and Alzheimer's",
    thumbnail: thumbnailVoice,
  },
  {
    key: "face",
    youtubeId: "NPmsdN1KAV0",
    title: "A simple video of your face can reveal your state of health",
    thumbnail: thumbnailFace,
  },
  {
    key: "records",
    youtubeId: "I9Mw6CTHXZo",
    title: "Medical records: too many errors! Building a complete and secure record",
    thumbnail: thumbnailRecords,
  },
];

export function getPodcastEpisode(key: PodcastEpisodeKey): PodcastEpisode {
  return PODCAST_EPISODES.find((episode) => episode.key === key)!;
}

/**
 * Le mode « confidentialité renforcée » de YouTube, chargé seulement au clic :
 * avant, la page n'envoie rien à YouTube (cf. la politique de confidentialité,
 * § Cookies).
 */
export function podcastEmbedUrl(youtubeId: string): string {
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?enablejsapi=1&autoplay=1&rel=0&list=${PODCAST_PLAYLIST_ID}`;
}
