import type { Game } from './types.ts';

const normalizeCategory = (category?: string | string[]): string[] => {
  if (!category) return [];

  if (Array.isArray(category)) {
    return category.map((item) => item.toLowerCase().trim());
  }

  return [category.toLowerCase().trim()];
};

interface InitFiltersParams {
  filterButtons: NodeListOf<HTMLElement>;
  getAllGamesData: () => Game[];
  buildGameGrid: (games: Game[]) => void;
  header: HTMLElement;
}

export const initFilters = ({
  filterButtons,
  getAllGamesData,
  buildGameGrid,
  header,
}: InitFiltersParams): void => {
  filterButtons.forEach((button) => {
    button.addEventListener('click', (event: MouseEvent) => {
      event.stopPropagation();

      filterButtons.forEach((item) => item.classList.remove('active'));
      button.classList.add('active');

      const filterValue = button.dataset.filter?.toLowerCase().trim();
      const allGamesData = getAllGamesData();

      if (!filterValue || filterValue === 'all' || filterValue === 'все') {
        buildGameGrid(allGamesData);
        header.classList.remove('active');
        return;
      }

      const filteredGames = allGamesData.filter((game) => {
        const categories = normalizeCategory(game.category);
        return categories.some((category) => category.includes(filterValue));
      });

      buildGameGrid(filteredGames);
      header.classList.remove('active');
    });
  });
};