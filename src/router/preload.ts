type Loader = () => Promise<unknown>;

const registry = new Map<string, Loader>();
const loaded = new Set<string>();

export function registerPreload(id: string, loader: Loader): void {
  registry.set(id, loader);
}

export function preload(id: string): void {
  if (loaded.has(id)) return;
  const loader = registry.get(id);
  if (!loader) return;
  loaded.add(id);
  void loader().catch(() => loaded.delete(id));
}
