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
    const full = this.currentPath;
    const qIdx = full.indexOf('?');
    const path = qIdx >= 0 ? full.slice(0, qIdx) : full;
    const qs = qIdx >= 0 ? full.slice(qIdx + 1) : '';

    for (const [pattern, handler] of Object.entries(this._routes)) {
      const match = this._matchPath(pattern, path);
      if (match) {
        this._currentRoute = pattern;
        const params = match.params;
        if (qs) {
          new URLSearchParams(qs).forEach((v, k) => { params[k] = v });
        }
        handler(params);
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
