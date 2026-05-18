import { Sun, Moon, Laptop } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { useTheme, type Theme } from '@/theme/ThemeProvider';

const order: Theme[] = ['light', 'dark', 'system'];

const labels: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Laptop;

  const cycle = () => {
    const idx = order.indexOf(theme);
    const next = order[(idx + 1) % order.length]!;
    setTheme(next);
  };

  return (
    <Tooltip content={`Theme: ${labels[theme]}`} side="bottom">
      <IconButton aria-label={`Theme: ${labels[theme]}`} onClick={cycle}>
        <Icon className="h-4 w-4" />
      </IconButton>
    </Tooltip>
  );
}
