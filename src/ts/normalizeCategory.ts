export const normalizeCategory = (category?: string | string[]): string[] => {
  if (!category) return [];

  if (Array.isArray(category)) {
    return category.map((item) => item.toLowerCase());
  }

  return [category.toLowerCase()];
};