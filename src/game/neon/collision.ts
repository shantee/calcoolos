/** Swept corridor collision. Ship spans z=-7..8, underside y=altitude-2.
 * Camera sway stays inside the 29 m wide roofs, so lateral overlap is guaranteed.
 * Sweeping both ends prevents crossing a whole roof between two rendered frames.
 */
export function hitsRoof(
  previousZ: number,
  currentZ: number,
  roof: { z: number; height: number; depth: number },
  altitude: number,
) {
  return (
    currentZ + roof.z - roof.depth / 2 <= 8 &&
    previousZ + roof.z + roof.depth / 2 >= -7 &&
    altitude - 2 <= roof.height + 0.7
  );
}
