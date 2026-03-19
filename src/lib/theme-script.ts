// This script runs BEFORE React hydrates to prevent theme flash
export const themeScript = `
(function() {
  try {
    const stored = localStorage.getItem('tastile-theme');
    if (stored) {
      const { state } = JSON.parse(stored);
      const theme = state?.theme || 'light';
      document.documentElement.classList.add('theme-' + theme);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.add(prefersDark ? 'theme-gray' : 'theme-light');
    }
  } catch (e) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.add(prefersDark ? 'theme-gray' : 'theme-light');
  }
})();
`;
