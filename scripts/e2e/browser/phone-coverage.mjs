export function phoneNavigationGaps(sidebarIds, reachableIds) {
  const reachable = new Set(reachableIds);
  return [...new Set(sidebarIds)].filter(id => !reachable.has(id));
}

export function phoneOverflowReport(path, scrollWidth, viewportWidth) {
  if (scrollWidth <= viewportWidth) return null;
  return { path, scrollWidth, viewportWidth, overflow: scrollWidth - viewportWidth };
}
