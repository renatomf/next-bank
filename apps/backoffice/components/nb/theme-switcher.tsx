import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Theme } from '@/lib/theme';
import { setTheme } from './theme-action';

const CHOICES = [
  { theme: 'system', label: 'Tema do sistema', icon: Monitor },
  { theme: 'light', label: 'Tema claro', icon: Sun },
  { theme: 'dark', label: 'Tema escuro', icon: Moon },
] as const;

/**
 * Light, dark or the system's (task 3.5, E2): plain forms posting to a
 * Server Action, so the choice works with no script of its own.
 */
export function ThemeSwitcher({ current }: { current: Theme }) {
  return (
    <div role="group" aria-label="Tema" className="flex gap-1">
      {CHOICES.map(({ theme, label, icon: Icon }) => (
        <form key={theme} action={setTheme}>
          <input type="hidden" name="theme" value={theme} />
          <Button
            type="submit"
            size="icon"
            variant={theme === current ? 'secondary' : 'ghost'}
            aria-label={label}
            aria-pressed={theme === current}
          >
            <Icon aria-hidden="true" />
          </Button>
        </form>
      ))}
    </div>
  );
}
