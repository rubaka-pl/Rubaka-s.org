import { supabase } from './supabase';
import type { Game } from './types';

type GameRow = {
  id: string;
  slug: string;
  title: string;
  thumbnail: string;
  iframe_url: string | null;
  size: 'small' | 'medium' | 'big';
  category: string;
  short_description: string | null;
  full_description: string | null;
  game_version: string | null;
  developer: string | null;
  controls_desktop: string | null;
  rating: number | null;
  votes_count: number;
  trailer_video_url: string | null;
  is_featured: boolean;
  is_published: boolean;
  sort_order: number;
};

export async function fetchGames(): Promise<Game[]> {
  const { data, error } = await supabase
    .from('games')
    .select(`
      id,
      slug,
      title,
      thumbnail,
      iframe_url,
      size,
      category,
      short_description,
      full_description,
      game_version,
      developer,
      controls_desktop,
      rating,
      votes_count,
      trailer_video_url,
      is_featured,
      is_published,
      sort_order
    `)
    .eq('is_published', true)
    .order('sort_order', { ascending: true });

  if (error) {
    throw error;
  }

  return (data as GameRow[]).map((game) => ({
    id: game.id,
    slug: game.slug,
    title: game.title,
    thumbnail: game.thumbnail,
    iframeUrl: game.iframe_url,
    size: game.size,
    category: game.category,
    shortDescription: game.short_description,
    fullDescription: game.full_description,
    gameVersion: game.game_version,
    developer: game.developer,
    controlsDesktop: game.controls_desktop,
    rating: game.rating,
    votesCount: game.votes_count,
    trailerVideoUrl: game.trailer_video_url,
    isFeatured: game.is_featured,
    isPublished: game.is_published,
    sortOrder: game.sort_order
  }));
}
