const Router = {
  _routes: {},
  _currentRoute: null,

  init() {
    window.addEventListener('hashchange', () => this._handleRoute());
    this._handleRoute();
  },

  on(pattern, handler) {
    this._routes[pattern] = handler;
  },

  navigate(path) {
    window.location.hash = '#' + path;
  },

  get currentPath() {
    return window.location.hash.slice(1) || '/';
  },

  _handleRoute() {
    const path = this.currentPath;
    for (const [pattern, handler] of Object.entries(this._routes)) {
      const match = this._matchPath(pattern, path);
      if (match) {
        this._currentRoute = pattern;
        handler(match.params);
        return;
      }
    }
    this._routes['/']?.({});
  },

  _matchPath(pattern, path) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    if (patternParts.length !== pathParts.length) return null;

    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
      } else if (patternParts[i] !== pathParts[i]) {
        return null;
      }
    }
    return { params };
  },
};
