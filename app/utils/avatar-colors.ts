export const AVATAR_COLOR_PALETTE: readonly string[] = [
  '#A9D9E8',
  '#A9C7E8',
  '#F4B8CC',
  '#B9DEC4',
  '#F4DC8E',
  '#C9B6E8',
];

export const pickNextColor = <T>(
  items: T[],
  getColor: (item: T) => string,
): string => {
  const colorUsage = AVATAR_COLOR_PALETTE.map((color) => ({
    color,
    count: items.filter(
      (item) => getColor(item).toUpperCase() === color.toUpperCase(),
    ).length,
  }));

  colorUsage.sort((a, b) => a.count - b.count);

  return colorUsage[0].color;
};
