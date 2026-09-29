import { app, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import type { MenuAction } from '@shared/types'

type ActionSender = (action: MenuAction) => void

let send: ActionSender | null = null

function action(label: string, action: MenuAction, accelerator?: string): MenuItemConstructorOptions {
  return {
    label,
    accelerator,
    click: () => send?.(action)
  }
}

/**
 * Builds the application menu.
 *
 * Menu clicks are forwarded to the renderer as `menu:action` events rather than
 * calling player methods directly, so the renderer stays the single owner of
 * playback state.
 */
export function buildMenu(onAction: ActionSender): Menu {
  send = onAction
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              action('Settings…', 'settings', 'Cmd+,'),
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          }
        ] as MenuItemConstructorOptions[])
      : []),
    {
      label: 'File',
      submenu: [action('Settings…', 'settings', 'Ctrl+,'), { type: 'separator' }, isMac ? { role: 'close' } : { role: 'quit' }]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'Playback',
      submenu: [
        action('Play / Pause', 'play-pause', 'Space'),
        { type: 'separator' },
        action('Previous', 'previous', 'CmdOrCtrl+Left'),
        action('Next', 'next', 'CmdOrCtrl+Right'),
        action('Restart Track', 'previous', 'CmdOrCtrl+Shift+Left'),
        { type: 'separator' },
        action('Seek Forward', 'seek-forward', 'CmdOrCtrl+Right'),
        action('Seek Backward', 'seek-backward', 'CmdOrCtrl+Left'),
        { type: 'separator' },
        action('Volume Up', 'volume-up', 'CmdOrCtrl+Up'),
        action('Volume Down', 'volume-down', 'CmdOrCtrl+Down'),
        { type: 'separator' },
        action('Toggle Shuffle', 'shuffle-toggle', 'CmdOrCtrl+S'),
        action('Cycle Repeat', 'repeat-toggle', 'CmdOrCtrl+R'),
        action('Clear Queue', 'clear-queue', 'CmdOrCtrl+Delete')
      ]
    },
    {
      label: 'View',
      submenu: [
        action('Show Navinator', 'show'),
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Navidrome Documentation',
          click: () => void shell.openExternal('https://www.navidrome.org/docs/')
        },
        {
          label: 'Subsonic API Reference',
          click: () => void shell.openExternal('https://opensubsonic.netlify.app/docs/')
        }
      ]
    }
  ]

  return Menu.buildFromTemplate(template)
}

export function installMenu(onAction: ActionSender): void {
  Menu.setApplicationMenu(buildMenu(onAction))
}
