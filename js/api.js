const API = {
  _token: null,
  _cache: new Map(),

  setToken(token) { this._token = token },

  getToken() { return this._token },

  async _fetch(path, opts = {}) {
    const url = `https://api.github.com${path}`;
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (this._token) headers['Authorization'] = `token ${this._token}`;
    if (opts.body && !(opts.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, { ...opts, headers });
    if (res.status === 204) return null;
    if (res.status === 401) { Auth.logout(); throw new Error('未授权') }
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

  async createLabel(name, color = 'ededed') {
    const exists = await this.ensureLabels();
    if (exists.has(name)) return;
    await this._fetch(`/repos/${CONFIG.owner}/${CONFIG.repo}/labels`, {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    }).catch(() => {});
    this._labels.add(name);
  },

  async ensureInitialLabels() {
    await Promise.all([
      this.createLabel('type:inn', '0e8a16'),
      this.createLabel('type:post', 'fbca04'),
      this.createLabel('type:solo', '5319e7'),
    ]);
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

  createIssue(title, body, labels = []) {
    return this._fetch(`/repos/${CONFIG.owner}/${CONFIG.repo}/issues`, {
      method: 'POST',
      body: JSON.stringify({ title, body, labels }),
    });
  },

  updateIssue(number, data) {
    return this._fetch(`/repos/${CONFIG.owner}/${CONFIG.repo}/issues/${number}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  listComments(issueNumber, page = 1) {
    return this._fetch(`/repos/${CONFIG.owner}/${CONFIG.repo}/issues/${issueNumber}/comments?page=${page}&per_page=100`);
  },

  createComment(issueNumber, body) {
    return this._fetch(`/repos/${CONFIG.owner}/${CONFIG.repo}/issues/${issueNumber}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  },

  updateComment(commentId, body) {
    return this._fetch(`/repos/${CONFIG.owner}/${CONFIG.repo}/issues/comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ body }),
    });
  },

  deleteComment(commentId) {
    return this._fetch(`/repos/${CONFIG.owner}/${CONFIG.repo}/issues/comments/${commentId}`, {
      method: 'DELETE',
    });
  },

  addReaction(issueNumber, content) {
    return this._fetch(`/repos/${CONFIG.owner}/${CONFIG.repo}/issues/${issueNumber}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ content }),
      headers: { 'Accept': 'application/vnd.github.squirrel-girl-preview+json' },
    }).catch(() => null);
  },

  removeReaction(issueNumber, reactionId) {
    return this._fetch(`/repos/${CONFIG.owner}/${CONFIG.repo}/issues/${issueNumber}/reactions/${reactionId}`, {
      method: 'DELETE',
    }).catch(() => null);
  },

  getUser(username) {
    return this._fetch(`/users/${username}`);
  },

  getMe() {
    return this._fetch('/user');
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
