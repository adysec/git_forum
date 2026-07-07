const API = {
  _cache: new Map(),

  async _fetch(path, opts = {}) {
    const url = `https://api.github.com${path}`;
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (opts.body && !(opts.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, { ...opts, headers });
    if (res.status === 204) return null;
    if (res.status === 403) {
      const reset = res.headers.get('X-RateLimit-Reset');
      const wait = reset ? Math.max(0, parseInt(reset) - Math.floor(Date.now() / 1000)) : 60;
      throw new Error(`请求频繁，${wait} 秒后重试`);
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    return res.json();
  },

  _labels: null,
  async ensureLabels() {
    if (this._labels) return this._labels;
    try {
      const labels = await this._fetch(`/repos/${CONFIG.owner}/${CONFIG.repo}/labels`);
      this._labels = new Set(labels.map(l => l.name));
    } catch { this._labels = new Set() }
    return this._labels;
  },

  async ensureInitialLabels() {
    await this.ensureLabels();
  },

  listIssues(label, page = 1, state = 'open') {
    const params = new URLSearchParams({
      state, page, per_page: CONFIG.per_page,
      sort: 'created', direction: 'desc',
    });
    if (label) params.set('labels', label);
    return this._fetch(`/repos/${CONFIG.owner}/${CONFIG.repo}/issues?${params}`);
  },

  getIssue(number) {
    return this._fetch(`/repos/${CONFIG.owner}/${CONFIG.repo}/issues/${number}`);
  },

  listComments(issueNumber, page = 1) {
    return this._fetch(`/repos/${CONFIG.owner}/${CONFIG.repo}/issues/${issueNumber}/comments?page=${page}&per_page=100`);
  },

  getUser(username) {
    return this._fetch(`/users/${username}`);
  },

  searchIssues(q, page = 1) {
    const params = new URLSearchParams({
      q: `${q}+repo:${CONFIG.owner}/${CONFIG.repo}`,
      sort: 'created',
      order: 'desc',
      page,
      per_page: CONFIG.per_page,
    });
    return this._fetch(`/search/issues?${params}`);
  },
};
