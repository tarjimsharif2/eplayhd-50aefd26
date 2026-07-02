import { Link, useLocation } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import { useBottomNavItems } from '@/hooks/useBottomNav';
import { cn } from '@/lib/utils';

const Icon = ({ name, className }: { name: string; className?: string }) => {
  const Cmp = (LucideIcons as any)[name] || LucideIcons.Circle;
  return <Cmp className={className} />;
};

const isActivePath = (currentPath: string, currentSearch: string, url: string) => {
  try {
    const [path, query = ''] = url.split('?');
    if (path !== currentPath) return false;
    if (!query) return currentSearch === '' || currentSearch === '?';
    const target = new URLSearchParams(query);
    const actual = new URLSearchParams(currentSearch);
    for (const [k, v] of target.entries()) {
      if (actual.get(k) !== v) return false;
    }
    return true;
  } catch {
    return false;
  }
};

const BottomNav = () => {
  const { data: items } = useBottomNavItems(true);
  const location = useLocation();

  if (!items || items.length === 0) return null;

  return (
    <>
      {/* spacer so content isn't hidden under fixed bar */}
      <div className="h-16 md:hidden" aria-hidden="true" />
      <nav
        className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t border-border bg-background/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.25)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Bottom navigation"
      >
        <ul className="flex items-stretch justify-around px-1">
          {items.map((item) => {
            const active = isActivePath(location.pathname, location.search, item.url);
            const isExternal = /^https?:\/\//i.test(item.url);
            const content = (
              <div
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 py-2 px-2 min-w-[56px] transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon name={item.icon_name} className="w-5 h-5" />
                <span className="text-[11px] font-medium leading-tight">{item.label}</span>
                {active && <span className="mt-0.5 h-0.5 w-6 rounded-full bg-primary" />}
              </div>
            );
            return (
              <li key={item.id} className="flex-1">
                {isExternal ? (
                  <a href={item.url} target="_blank" rel="noreferrer" className="block">
                    {content}
                  </a>
                ) : (
                  <Link to={item.url} className="block">
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
};

export default BottomNav;