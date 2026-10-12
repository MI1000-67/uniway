// Moving an entrance changes the meaning of every attached path; review it again.
export function movePlace(campus, id, point) {
  const place = campus.places.find((p) => p.id === id);
  if (
    !place ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    point.x < 0 ||
    point.x > 1000 ||
    point.y < 0 ||
    point.y > 800
  )
    return campus;
  return {
    ...campus,
    places: campus.places.map((p) => (p.id === id ? { ...p, ...point } : p)),
    images: campus.images.map((image, floor) =>
      floor === place.floor ? { ...image, reviewed: false } : image,
    ),
    edges: campus.edges.map((e) => {
      if (e.a !== id && e.b !== id) return e;
      const points = e.points?.map((p, i) =>
        (i === 0 && e.a === id) || (i === e.points.length - 1 && e.b === id) ? { ...point } : p,
      );
      return { ...e, ...(points ? { points } : {}), confirmed: false, accessible: false };
    }),
  };
}
