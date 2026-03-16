export type GameSize = 'small' | 'medium' | 'big';

export interface Game {
  id: string;
  slug: string;
  title: string;
  thumbnail: string;
  iframeUrl: string | null;
  size: GameSize;
  category: string;
  shortDescription: string | null;
  fullDescription: string | null;
  gameVersion: string | null;
  developer: string | null;
  controlsDesktop: string | null;
  rating: number | null;
  votesCount: number;
  trailerVideoUrl: string | null;
  isFeatured: boolean;
  isPublished: boolean;
  sortOrder: number;
}
