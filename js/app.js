const ImageStore = {
  _db: null,
  async _getDB() {
    if (this._db) return this._db;
    return new Promise((res, rej) => {
      const r = indexedDB.open('ForumPasteImages', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('images', { keyPath: 'id' });
      r.onsuccess = () => { this._db = r.result; res(this._db) };
      r.onerror = () => rej(r.error);
    });
  },
  async save(id, dataUrl) {
    const db = await this._getDB();
    return new Promise((res, rej) => {
      const tx = db.transaction('images', 'readwrite');
      tx.objectStore('images').put({ id, dataUrl, created: Date.now() });
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  },
  async get(id) {
    const db = await this._getDB();
    return new Promise((res, rej) => {
      const tx = db.transaction('images', 'readonly');
      const r = tx.objectStore('images').get(id);
      r.onsuccess = () => res(r.result?.dataUrl);
      r.onerror = () => rej(r.error);
    });
  },
  async cleanup() {
    const db = await this._getDB();
    const tx = db.transaction('images', 'readwrite');
    const store = tx.objectStore('images');
    const r = store.openCursor();
    r.onsuccess = (e) => {
      const c = e.target.result;
      if (c) {
        if (Date.now() - c.value.created > 3600000) store.delete(c.key);
        c.continue();
      }
    };
  },
};

const App = {
  _page: 1,

  _githubUrl(path = '') {
    return `https://github.com/${CONFIG.owner}/${CONFIG.repo}${path}`;
  },

  _newIssueUrl(labels, title, body) {
    const base = `https://github.com/${CONFIG.owner}/${CONFIG.repo}/issues/new`;
    const params = new URLSearchParams();
    if (labels && labels.length) params.set('labels', labels.join(','));
    if (title) params.set('title', title);
    if (body) params.set('body', body);
    return base + '?' + params.toString();
  },

  async init() {
    try {
      ImageStore.cleanup().catch(() => {});
      Router.on('/', (p) => this.home(p));
      Router.on('/inn/list', (p) => this.innList(p));
      Router.on('/inn/:iid', (p) => this.innView(p));
      Router.on('/post/new', (p) => this.postNew(p));
      Router.on('/post/:iid/:pid', (p) => this.postView(p));
      Router.on('/user/:login', (p) => this.userView(p));
      Router.on('/search', (p) => this.search(p));
      Router.init();
    } catch (e) {
      document.getElementById('content').innerHTML =
        Components.error('初始化失败：' + e.message).outerHTML;
    }
  },

  _setContent(html) {
    document.getElementById('content').innerHTML = html;
  },

  _issueToPost(issue) {
    const innLabel = issue.labels.find(l => l.name.startsWith('inn:'));
    return {
      number: issue.number,
      title: issue.title,
      body: issue.body || '',
      user: issue.user,
      created_at: issue.created_at,
      comments: issue.comments,
      reactions: issue.reactions,
      inn: innLabel ? innLabel.name.slice(4) : 'general',
      labels: issue.labels.map(l => l.name),
    };
  },

  _renderPostRow(post) {
    return `
      <tr>
        <td class="t-icon${post.comments > 0 ? ' hot' : ''}">${post.comments > 0 ? '🔥' : '💬'}</td>
        <td class="t-title">
          <a href="#/post/${post.inn || 'general'}/${post.number}">${post.title}</a>
          ${post.inn !== 'general' ? `<span class="t-inn">${post.inn}</span>` : ''}
          ${post.labels.filter(l => l.startsWith('tag:')).map(l => `<span class="t-tag">${l.slice(4)}</span>`).join('')}
        </td>
        <td class="t-author"><a href="#/user/${post.user.login}">${post.user.login}</a></td>
        <td class="t-replies">${post.comments}</td>
        <td class="t-last">${Components.timeAgo(post.created_at)}</td>
      </tr>
    `;
  },

  async home() {
    this._setContent(Components.loading().outerHTML);
    try {
      this._page = 1;
      const [issues, inns] = await Promise.all([
        API.listIssues(CONFIG.labels.post, 1),
        API.listIssues(CONFIG.labels.inn),
      ]);
      const posts = issues.map(i => this._issueToPost(i));
      const hasMore = issues.length >= CONFIG.per_page;

      const forumRows = inns.map(inn => `
        <tr>
          <td class="f-icon">📁</td>
          <td class="f-main">
            <a href="#/inn/${inn.number}" class="f-name">${inn.title}</a>
            <div class="f-desc">${inn.body ? Components.parseMarkdown(inn.body.slice(0, 120)) : '暂无描述'}</div>
          </td>
          <td class="f-count">-</td>
          <td class="f-last">-</td>
        </tr>
      `).join('');

      const html = `
        <div class="f-index">
          <div class="f-header"><h2>📋 版块</h2></div>
          <table class="f-table">
            <thead><tr><th></th><th>版块</th><th>帖子</th><th>最后发表</th></tr></thead>
            <tbody>${forumRows || '<tr><td colspan="4" class="empty-td">暂无版块 · <a href="#/inn/list">创建社区</a></td></tr>'}</tbody>
          </table>
          <div class="f-stats">版块: ${inns.length} | 帖子: ${issues.length}+</div>

          <div class="f-header" style="margin-top:24px">
            <h2>📌 最新帖子</h2>
            <div class="f-actions">
              <a href="#/search" class="btn btn-sm">搜索</a>
              <a href="#/post/new" class="btn btn-sm btn-primary">＋发帖</a>
            </div>
          </div>
          <table class="t-table">
            <thead><tr><th></th><th>标题</th><th>作者</th><th>回复</th><th>最后发表</th></tr></thead>
            <tbody id="post-list">${posts.length === 0 ? '<tr><td colspan="5" class="empty-td">暂无帖子</td></tr>' : posts.map(p => this._renderPostRow(p)).join('')}</tbody>
          </table>
          <div id="pagination"></div>
        </div>
      `;
      this._setContent(html);
      document.getElementById('pagination').appendChild(
        Components.pagination(this._page, hasMore, () => this._loadPage(-1), () => this._loadPage(1)));
    } catch (e) {
      this._setContent(Components.error(e.message).outerHTML);
    }
  },

  async _loadPage(delta) {
    this._page += delta;
    if (this._page < 1) this._page = 1;
    document.getElementById('post-list').innerHTML =
      '<tr><td colspan="5"><div class="loading" style="padding:20px">加载中...</div></td></tr>';
    document.getElementById('pagination').innerHTML = '';
    try {
      const issues = await API.listIssues(CONFIG.labels.post, this._page);
      const hasMore = issues.length >= CONFIG.per_page;
      const posts = issues.map(i => this._issueToPost(i));
      document.getElementById('post-list').innerHTML = posts.map(p => this._renderPostRow(p)).join('');
      document.getElementById('pagination').appendChild(
        Components.pagination(this._page, hasMore, () => this._loadPage(-1), () => this._loadPage(1)));
    } catch (e) {
      document.getElementById('post-list').innerHTML =
        `<tr><td colspan="5"><div class="error">${e.message}</div></td></tr>`;
    }
  },

  async innList() {
    this._setContent(Components.loading().outerHTML);
    try {
      const issues = await API.listIssues(CONFIG.labels.inn);
      const inns = issues.map(i => ({
        number: i.number,
        name: i.title,
        body: i.body || '',
        user: i.user,
        created_at: i.created_at,
      }));
      const html = `
        <div class="f-index">
          <div class="f-header">
            <h2>📋 社区列表</h2>
            <div class="f-actions">
              <a href="${this._newIssueUrl([CONFIG.labels.inn])}" target="_blank" class="btn btn-sm">＋创建社区</a>
            </div>
          </div>
          ${inns.length === 0 ? Components.empty('暂无社区').outerHTML :
            inns.map(inn => `
              <div class="inn-card">
                <div class="inn-icon">📁</div>
                <div class="inn-body">
                  <a href="#/inn/${inn.number}" class="inn-name">${inn.name}</a>
                  <div class="inn-meta">创建者: <a href="#/user/${inn.user.login}">${inn.user.login}</a> · ${Components.timeAgo(inn.created_at)}</div>
                  ${inn.body ? `<div class="inn-desc">${Components.parseMarkdown(inn.body.slice(0, 200))}</div>` : ''}
                </div>
              </div>
            `).join('')
          }
        </div>
      `;
      this._setContent(html);
    } catch (e) {
      this._setContent(Components.error(e.message).outerHTML);
    }
  },

  async innView(params) {
    this._setContent(Components.loading().outerHTML);
    try {
      const innIssue = await API.getIssue(params.iid);
      const innName = innIssue.title;
      const innSlug = innName.toLowerCase().replace(/\s+/g, '-');
      const searchQuery = `label:${CONFIG.labels.post}+label:inn:${innSlug}`;
      const searchResult = await API.searchIssues(searchQuery);
      const posts = (searchResult.items || []).map(i => this._issueToPost(i));
      const html = `
        <div class="f-index">
          <div class="f-header">
            <h2>📋 ${innName}</h2>
            <div class="f-actions">
              <a href="#/" class="btn btn-sm">← 返回</a>
              <a href="#/post/new?inn=${innSlug}" class="btn btn-sm btn-primary">＋发帖</a>
            </div>
          </div>
          ${innIssue.body ? `<div class="inn-desc-bar">${Components.parseMarkdown(innIssue.body)}</div>` : ''}
          <table class="t-table">
            <thead><tr><th></th><th>标题</th><th>作者</th><th>回复</th><th>最后发表</th></tr></thead>
            <tbody>${posts.length === 0 ? '<tr><td colspan="5" class="empty-td">此社区暂无帖子</td></tr>' : posts.map(p => this._renderPostRow(p)).join('')}</tbody>
          </table>
        </div>
      `;
      this._setContent(html);
    } catch (e) {
      this._setContent(Components.error(e.message).outerHTML);
    }
  },

  _insertMd(tag) {
    const ta = document.getElementById('post-content');
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = ta.value;
    const sel = text.slice(start, end);
    const inserts = {
      bold: ['**', '**'], italic: ['*', '*'], heading: ['## ', ''],
      link: ['[', '](url)'], image: ['', ''],
      code: ['`', '`'], codeblock: ['```\n', '\n```'],
      list: ['- ', ''], quote: ['> ', ''],
    };
    const [pre, post] = inserts[tag] || ['', ''];
    const placeholder = tag === 'link' ? '链接文字' : tag === 'image' ? '图片描述' : '';
    if (tag === 'image') {
      const url = prompt('输入图片链接（或提交后在 GitHub 拖拽上传）：', 'https://');
      if (!url) return;
      const imgMd = `![${sel || '图片'}](${url})`;
      ta.value = text.slice(0, start) + imgMd + text.slice(end);
      ta.selectionStart = ta.selectionEnd = start + imgMd.length;
      ta.focus(); return;
    }
    const inserted = pre + (sel || placeholder) + post;
    ta.value = text.slice(0, start) + inserted + text.slice(end);
    const cursor = tag === 'link' ? start + pre.length + placeholder.length
      : tag === 'codeblock' || tag === 'quote' || tag === 'list' || tag === 'heading'
        ? start + pre.length + (sel ? sel.length : 0)
        : start + inserted.length;
    ta.selectionStart = ta.selectionEnd = cursor;
    ta.focus();
  },

  async postNew(params) {
    this._setContent(Components.loading().outerHTML);
    try {
      const preInn = (params && params.inn) || '';
      const inns = await API.listIssues(CONFIG.labels.inn).catch(() => []);
      const innOptions = inns.map(i => {
        const slug = i.title.toLowerCase().replace(/\s+/g, '-');
        return `<option value="${slug}"${slug === preInn ? ' selected' : ''}>${i.title}</option>`;
      }).join('');
      const html = `
        <div class="f-index" style="max-width:700px">
          <div class="f-header"><h2>📝 发新帖</h2></div>
          <p style="font-size:13px;color:var(--text-secondary);margin:0 0 16px 0">填写完成后跳转到 GitHub 提交，可在 GitHub 拖拽上传图片。</p>
          <form id="post-form">
            <div class="form-group">
              <label>所属社区</label>
              <select id="post-inn" class="form-input">
                <option value="">综合</option>
                ${innOptions}
              </select>
            </div>
            <div class="form-group">
              <label>标题</label>
              <input id="post-title" class="form-input" required maxlength="256" placeholder="帖子标题">
            </div>
            <div class="form-group">
              <label>标签（逗号分隔）</label>
              <input id="post-tags" class="form-input" placeholder="例如：rust, 求助, 讨论">
            </div>
            <div class="form-group">
              <label>内容（支持 Markdown）</label>
              <div class="md-toolbar" id="md-toolbar">
                <button type="button" class="md-btn" data-tag="bold" title="加粗"><b>B</b></button>
                <button type="button" class="md-btn" data-tag="italic" title="斜体"><i>I</i></button>
                <button type="button" class="md-btn" data-tag="heading" title="标题">H</button>
                <button type="button" class="md-btn" data-tag="link" title="链接">🔗</button>
                <button type="button" class="md-btn" data-tag="image" title="图片">🖼</button>
                <button type="button" class="md-btn" data-tag="code" title="代码">&lt;/&gt;</button>
                <button type="button" class="md-btn" data-tag="codeblock" title="代码块">\`\`\`</button>
                <button type="button" class="md-btn" data-tag="list" title="列表">•</button>
                <button type="button" class="md-btn" data-tag="quote" title="引用">&gt;</button>
                <span class="md-hint">📋 粘贴图片自动存储</span>
              </div>
              <textarea id="post-content" class="form-input" required maxlength="65000" placeholder="写下你的内容..." style="min-height:220px;border-radius:0 0 var(--radius) var(--radius)"></textarea>
            </div>
            <button type="submit" class="btn btn-primary">提交到 GitHub →</button>
          </form>
        </div>
      `;
      this._setContent(html);
      document.getElementById('md-toolbar')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.md-btn');
        if (btn) this._insertMd(btn.dataset.tag);
      });
      const ta = document.getElementById('post-content');
      ta.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items;
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            e.preventDefault();
            const file = item.getAsFile();
            const reader = new FileReader();
            reader.onload = (ev) => {
              const dataUrl = ev.target.result;
              const id = 'paste_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
              ImageStore.save(id, dataUrl).catch(() => {});
              const imgMd = `![${file.name || 'image'}](${dataUrl})`;
              const start = ta.selectionStart;
              const end = ta.selectionEnd;
              ta.value = ta.value.slice(0, start) + imgMd + ta.value.slice(end);
              ta.selectionStart = ta.selectionEnd = start + imgMd.length;
              ta.dispatchEvent(new Event('input'));
            };
            reader.readAsDataURL(file);
          }
        }
      });
      document.getElementById('post-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const inn = document.getElementById('post-inn').value;
        const title = document.getElementById('post-title').value;
        const tags = document.getElementById('post-tags').value;
        const content = document.getElementById('post-content').value;
        const labels = [CONFIG.labels.post];
        if (inn) labels.push(`inn:${inn}`);
        tags.split(',').map(t => t.trim()).filter(t => t).forEach(t => labels.push(`tag:${t.toLowerCase().replace(/\s+/g, '-')}`));
        window.open(this._newIssueUrl(labels, title, content), '_blank');
        Router.navigate('/');
      });
    } catch (e) {
      this._setContent(Components.error(e.message).outerHTML);
    }
  },

  async postView(params) {
    this._setContent(Components.loading().outerHTML);
    try {
      const issue = await API.getIssue(params.pid);
      const post = this._issueToPost(issue);
      const comments = await API.listComments(params.pid);
      const issueUrl = this._githubUrl(`/issues/${params.pid}`);
      const backLink = document.referrer && document.referrer.includes(window.location.host)
        ? 'javascript:history.back()' : '#/';
      const html = `
        <div class="pv-top">
          <a href="${backLink}" class="btn btn-sm">← 返回</a>
          <a href="${issueUrl}" target="_blank" class="btn btn-sm btn-primary">回复</a>
        </div>
        <div class="pv-post">
          <div class="pv-sidebar">
            <a href="#/user/${post.user.login}"><img src="${post.user.avatar_url}" class="pv-avatar" alt=""></a>
            <a href="#/user/${post.user.login}" class="pv-username">${post.user.login}</a>
          </div>
          <div class="pv-main">
            <h1 class="pv-title">${post.title}</h1>
            <div class="pv-meta">
              <span>发表于 ${new Date(post.created_at).toLocaleString()}</span>
              ${post.labels.filter(l => l.startsWith('tag:')).map(l => `<span class="tag">${l.slice(4)}</span>`).join('')}
            </div>
            <div class="pv-body">${Components.parseMarkdown(post.body)}</div>
            <div class="pv-footer">
              <span>💬 ${post.comments} 回复</span>
              <span>📁 ${post.inn || '综合'}</span>
            </div>
          </div>
        </div>
        <h2 class="pv-cmt-title">评论 (${comments.length})</h2>
        ${comments.length === 0
          ? `<div class="pv-cmt-empty">暂无评论 · <a href="${issueUrl}" target="_blank">在 GitHub 上回复</a></div>`
          : comments.map(c => `
            <div class="pv-post pv-comment">
              <div class="pv-sidebar">
                <a href="#/user/${c.user.login}"><img src="${c.user.avatar_url}" class="pv-avatar" alt=""></a>
                <a href="#/user/${c.user.login}" class="pv-username">${c.user.login}</a>
              </div>
              <div class="pv-main">
                <div class="pv-cmt-meta">#${c.id} · ${Components.timeAgo(c.created_at)}</div>
                <div class="pv-body">${Components.parseMarkdown(c.body)}</div>
              </div>
            </div>
          `).join('')
        }
      `;
      this._setContent(html);
    } catch (e) {
      this._setContent(Components.error(e.message).outerHTML);
    }
  },

  async userView(params) {
    this._setContent(Components.loading().outerHTML);
    try {
      const user = await API.getUser(params.login);
      const userIssues = await API.searchIssues(`author:${params.login}+label:${CONFIG.labels.post}`);
      const posts = (userIssues.items || []).map(i => this._issueToPost(i));
      const html = `
        <div class="f-index">
          <div class="user-profile">
            <img src="${user.avatar_url}" alt="">
            <h1>${user.name || user.login}</h1>
            <div class="user-login">@${user.login}</div>
            ${user.bio ? `<div class="user-bio">${user.bio}</div>` : ''}
            ${user.location ? `<div class="user-bio">📍 ${user.location}</div>` : ''}
            <div class="user-stats">
              <div class="user-stat"><div class="num">${posts.length}</div><div class="label">帖子</div></div>
              <div class="user-stat"><div class="num">${user.public_repos || 0}</div><div class="label">仓库</div></div>
            </div>
            <a href="https://github.com/${params.login}" target="_blank" class="btn btn-sm">GitHub</a>
          </div>
          <div class="f-header" style="margin-top:24px"><h2>📌 ${params.login} 的帖子</h2></div>
          ${posts.length === 0
            ? Components.empty('暂无帖子').outerHTML
            : `<table class="t-table"><thead><tr><th></th><th>标题</th><th>作者</th><th>回复</th><th>最后发表</th></tr></thead><tbody>${posts.slice(0, 10).map(p => this._renderPostRow(p)).join('')}</tbody></table>
               ${posts.length > 10 ? `<a href="#/search?author=${params.login}" class="btn btn-sm" style="margin-top:8px">查看全部 →</a>` : ''}`
          }
        </div>
      `;
      this._setContent(html);
    } catch (e) {
      this._setContent(Components.error(e.message).outerHTML);
    }
  },

  async search(params) {
    const q = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const query = q.get('q') || '';
    const author = q.get('author') || '';
    this._setContent(`
      <div class="f-index">
        <div class="f-header"><h2>🔍 搜索</h2></div>
        <form id="search-form" class="search-bar">
          <input id="search-input" class="form-input" placeholder="搜索帖子..." value="${query}">
          <button type="submit" class="btn btn-primary">搜索</button>
        </form>
        <div id="search-results"></div>
      </div>
    `);
    document.getElementById('search-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      window.location.hash = `#/search?q=${encodeURIComponent(document.getElementById('search-input').value)}`;
    });
    if (query || author) {
      const el = document.getElementById('search-results');
      el.innerHTML = Components.loading().outerHTML;
      try {
        let sq = `repo:${CONFIG.owner}/${CONFIG.repo}+label:${CONFIG.labels.post}`;
        if (query) sq += `+${query}`;
        if (author) sq += `+author:${author}`;
        const res = await API.searchIssues(sq);
        const posts = (res.items || []).map(i => this._issueToPost(i));
        el.innerHTML = posts.length === 0 ? Components.empty('未找到结果').outerHTML
          : `<table class="t-table"><thead><tr><th></th><th>标题</th><th>作者</th><th>回复</th><th>最后发表</th></tr></thead><tbody>${posts.map(p => this._renderPostRow(p)).join('')}</tbody></table>`;
      } catch (e) {
        el.innerHTML = Components.error(e.message).outerHTML;
      }
    }
  },
};
