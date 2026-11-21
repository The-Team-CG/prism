export function phoneNavigationGaps(sidebarIds, reachableIds) {
  const reachable = new Set(reachableIds);
  return [...new Set(sidebarIds)].filter(id => !reachable.has(id));
}

export function phoneOverflowReport(path, scrollWidth, viewportWidth, culprits = []) {
  if (scrollWidth <= viewportWidth) return null;
  return { path, scrollWidth, viewportWidth, overflow: scrollWidth - viewportWidth, culprits };
}

/** BROWSER_PHONE_WIDTH narrows the mobile project to another phone width; the shell keeps the phone bar below 768px. */
export function phoneViewport(value) {
  if (!value) return null;
  const width = Number(value);
  if (!Number.isInteger(width) || width < 320 || width >= 768) throw new Error('BROWSER_PHONE_WIDTH must be an integer from 320 to 767.');
  return { width, height: 844 };
}
