// This script runs BEFORE React hydrates to prevent theme flash
export const themeScript = `
(function() {
  try {
    const stored = localStorage.getItem('theme-storage');
    if (stored) {
      const { state } = JSON.parse(stored);
      const theme = state?.theme || 'light';
      document.documentElement.classList.add('theme-' + theme);
    } else {
      document.documentElement.classList.add('theme-light');
    }
  } catch (e) {
    document.documentElement.classList.add('theme-light');
  }
})();
`;
