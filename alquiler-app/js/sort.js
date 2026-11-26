// Orden de la galería: lo más reciente primero; el catálogo inicial, en su orden.
export const sortWorks = (arr) => [...arr].sort((a, b) => (b.date || b.createdAt || 0) - (a.date || a.createdAt || 0) || (a.order ?? 0) - (b.order ?? 0));
