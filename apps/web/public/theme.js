// Apply the saved appearance before React paints, without an inline script.
try {
  const saved = localStorage.getItem('udyam:theme')
  document.documentElement.dataset.theme = saved === 'light' || saved === 'dark'
    ? saved : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
} catch {
  document.documentElement.dataset.theme = 'light'
}
