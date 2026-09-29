import { useEffect, useState } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import {
  Compass,
  Disc3,
  Users,
  Library,
  Heart,
  ListMusic,
  Settings as SettingsIcon,
  Search,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { usePlayer } from '../../store/player'
import { useServer } from '../../store/server'
import { IconButton } from '../ui/primitives'
import { Tooltip } from '../ui/overlays'
import { Avatar } from '../items/CoverArt'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Listen',
    items: [
      { to: '/', label: 'Home', icon: Compass },
      { to: '/search', label: 'Search', icon: Search }
    ]
  },
  {
    title: 'Library',
    items: [
      { to: '/albums', label: 'Albums', icon: Disc3 },
      { to: '/artists', label: 'Artists', icon: Users },
      { to: '/playlists', label: 'Playlists', icon: ListMusic },
      { to: '/genres', label: 'Genres', icon: Library }
    ]
  },
  {
    title: 'You',
    items: [{ to: '/favourites', label: 'Favourites', icon: Heart }]
  }
]

export function Sidebar() {
  const navigate = useNavigate()
  const queueCount = usePlayer((s) => s.queue.length)
  const username = useServer((s) => s.connection.profile?.username)
  const serverName = useServer((s) => s.connection.profile?.name)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('navinator:sidebar') === 'collapsed')
    } catch {
      /* first run */
    }
  }, [])

  const toggle = () => {
    setCollapsed((value) => {
      const next = !value
      try {
        localStorage.setItem('navinator:sidebar', next ? 'collapsed' : 'expanded')
      } catch {
        /* storage is optional */
      }
      return next
    })
  }

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200',
        collapsed ? 'w-[68px]' : 'w-56'
      )}
    >
      <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-3">
        {SECTIONS.map((section) => (
          <div key={section.title} className="space-y-0.5">
            {!collapsed && (
              <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-faint">
                {section.title}
              </div>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                item={item}
                collapsed={collapsed}
                onSelect={() => navigate({ to: item.to })}
              />
            ))}
          </div>
        ))}

        <div className="space-y-0.5">
          <NavLink
            item={{ to: '/queue', label: 'Queue', icon: ListMusic }}
            collapsed={collapsed}
            badge={queueCount || undefined}
            onSelect={() => navigate({ to: '/queue' })}
          />
          <NavLink
            item={{ to: '/settings', label: 'Settings', icon: SettingsIcon }}
            collapsed={collapsed}
            onSelect={() => navigate({ to: '/settings' })}
          />
        </div>
      </nav>

      {/* Connection footer */}
      <div
        className={cn(
          'flex items-center gap-2.5 border-t border-line p-2.5',
          collapsed && 'justify-center'
        )}
      >
        <Avatar username={username} size={collapsed ? 28 : 30} />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-fg">{serverName ?? 'Not connected'}</div>
            <div className="truncate text-[11px] text-faint">{username ?? 'Choose a server'}</div>
          </div>
        )}
        <IconButton
          label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          size="icon-xs"
          variant="ghost"
          onClick={toggle}
        >
          {collapsed ? <ChevronsRight className="size-3.5" /> : <ChevronsLeft className="size-3.5" />}
        </IconButton>
      </div>
    </aside>
  )
}

function NavLink({
  item,
  collapsed,
  badge,
  onSelect
}: {
  item: NavItem
  collapsed: boolean
  badge?: number
  onSelect: () => void
}) {
  const path = useRouterState({ select: (state) => state.location.pathname })
  const active = item.to === '/' ? path === '/' : path.startsWith(item.to)
  const Icon = item.icon

  const button = (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
        collapsed && 'justify-center px-0',
        active ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg'
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
      {!collapsed && badge ? (
        <span className="tabular rounded-full bg-surface-3 px-1.5 text-[10px] text-muted">{badge}</span>
      ) : null}
    </button>
  )

  return collapsed ? (
    <Tooltip label={item.label} side="right">
      {button}
    </Tooltip>
  ) : (
    button
  )
}
