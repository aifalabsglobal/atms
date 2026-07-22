/** Campus ATMS vs standalone Knuct console session surface. */
export type AuthSurface = 'campus' | 'knuct';

export function parseAuthSurface(value: unknown): AuthSurface {
  return value === 'knuct' ? 'knuct' : 'campus';
}
