import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setTheme } from './theme-action';

/**
 * One toggle for light and dark (task 3.5, E10): a moon in the light theme,
 * a sun in the dark. Until the member picks one the system decides, and the
 * server cannot know which, so both buttons come in the page and the CSS
 * shows the one that fits. No script of its own.
 */
export function ThemeToggle() {
  return (
    <form action={setTheme}>
      <Button
        type="submit"
        name="theme"
        value="dark"
        variant="ghost"
        size="icon"
        aria-label="Ativar tema escuro"
        className="dark:hidden"
      >
        <Moon aria-hidden="true" />
      </Button>
      <Button
        type="submit"
        name="theme"
        value="light"
        variant="ghost"
        size="icon"
        aria-label="Ativar tema claro"
        className="hidden dark:inline-flex"
      >
        <Sun aria-hidden="true" />
      </Button>
    </form>
  );
}
