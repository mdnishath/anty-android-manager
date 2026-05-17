// WSL keepalive stub. The real implementation will periodically ping WSL
// so Docker Desktop doesn't suspend it. For now it's a no-op so the app
// boots cleanly without WSL or Docker installed.

let timer: NodeJS.Timeout | null = null;

export function startWslKeepalive(): void {
  if (timer) return;
  timer = setInterval(() => {
    // future: spawn('wsl', ['echo', 'ping']) with short timeout
  }, 60_000);
}

export function stopWslKeepalive(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
