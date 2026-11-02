import { describe, expect, it } from 'vitest';
import { navigationFor } from '../components/nb/navigation';

// What each role sees in the sidebar, the drawer and the home's shortcuts
// (task 3.5, E9): one list, with the roles of each item. It only spares a
// 403: the API decides what each role reads (STF-02).
const pathsOf = (role: string) => navigationFor(role).map((item) => item.href);

describe('navigationFor', () => {
  it.each(['OPERATOR', 'ANALYST'])('shows the customers and the requests to the %s', (role) => {
    expect(pathsOf(role)).toEqual(['/', '/clientes', '/pedidos']);
  });

  it('keeps the customers away from the admin (task 3, C1)', () => {
    expect(pathsOf('ADMIN')).toEqual(['/']);
  });

  it('shows only the home to a role it does not know', () => {
    expect(pathsOf('SOMEONE')).toEqual(['/']);
  });

  it('gives every item a label and an icon', () => {
    for (const item of navigationFor('ANALYST')) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.icon).toBeDefined();
    }
  });
});
