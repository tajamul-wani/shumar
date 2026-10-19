// Runs before the page first draws, so it never flashes the wrong theme.
// Mirrors src/lib/theme.ts. The two colors are the koshur-base tokens from src/index.css,
// for the phone's status bar until the app takes over.
;(function () {
  var theme = 'dark'
  try {
    var saved = localStorage.getItem('shumar-theme')
    if (saved === 'light' || saved === 'dark') theme = saved
    else if (window.matchMedia('(prefers-color-scheme: light)').matches) theme = 'light'
  } catch {
    // Storage blocked: keep following the device where possible.
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) theme = 'light'
  }
  document.documentElement.dataset.theme = theme
  var meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = theme === 'light' ? '#F7F4EE' : '#0C0B0A'
})()
