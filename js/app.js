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
      ImageStore.cleanup();

      Router.on('/', (p) => this.home(p));
      Router.on('/inn/list', (p) => this.innList(p));
      Router.on('/inn/:iid', (p) => this.innView(p));
      Router.on('/post/new', (p) => this.postNew(p));
      Router.on('/post/:iid/:pid', (p) => this.postView(p));
      Router.on('/solo/user/:uid', (p) => this.soloList(p));
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

  _renderPostCard(post) {
    const ts = Components.timeAgo(post.created_at);
    return `
      <div class="card">
        <div class="card-title">
          <a href="#/post/${post.inn || 'general'}/${post.number}">${post.title}</a>
        </div>
        <div class="card-meta">
          <span class="user-badge">
            <img src="${post.user.avatar_url}" width="16" height="16" style="border-radius:50%" alt="">
            <a href="#/user/${post.user.login}">${post.user.login}</a>
          </span>
          <span>${ts}</span>
          ${post.comments > 0 ? `<span>💬 ${post.comments}</span>` : ''}
          ${post.inn ? `<span class="tag">${post.inn}</span>` : ''}
        </div>
      </div>
    `;
  },

  async _fetchWithFallback(fetchLabelFn) {
    try {
      return await fetchLabelFn();
    } catch {
      return [];
    }
  },

  async home() {
    this._setContent(Components.loading().outerHTML);
    try {
      this._page = 1;
      let issues = await API.listIssues(CONFIG.labels.post, 1);
      const hasMore = issues.length >= CONFIG.per_page;
      const posts = issues.map(i => this._issueToPost(i));
      const html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <h1 style="font-size:20px;font-weight:700">最新帖子</h1>
          <div>
            <a href="#/search" class="btn btn-sm">搜索</a>
            <a href="#/post/new" class="btn btn-sm btn-primary">发帖</a>
          </div>
        </div>
        <div id="post-list">${posts.map(p => this._renderPostCard(p)).join('')}</div>
        <div id="pagination"></div>
      `;
      this._setContent(html);
      const paginationEl = document.getElementById('pagination');
      paginationEl.appendChild(Components.pagination(
        this._page, hasMore,
        () => this._loadPage(-1),
        () => this._loadPage(1),
      ));
    } catch (e) {
      this._setContent(Components.error(e.message).outerHTML);
    }
  },

  async _loadPage(delta) {
    this._page += delta;
    if (this._page < 1) this._page = 1;
    const loading = Components.loading();
    document.getElementById('post-list').innerHTML = '';
    document.getElementById('pagination').innerHTML = '';
    document.getElementById('post-list').appendChild(loading);
    try {
      const issues = await API.listIssues(CONFIG.labels.post, this._page);
      const hasMore = issues.length >= CONFIG.per_page;
      const posts = issues.map(i => this._issueToPost(i));
      document.getElementById('post-list').innerHTML = posts.map(p => this._renderPostCard(p)).join('');
      const paginationEl = document.getElementById('pagination');
      paginationEl.innerHTML = '';
      paginationEl.appendChild(Components.pagination(
        this._page, hasMore,
        () => this._loadPage(-1),
        () => this._loadPage(1),
      ));
    } catch (e) {
      document.getElementById('post-list').innerHTML = Components.error(e.message).outerHTML;
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
        <h1 style="font-size:20px;font-weight:700;margin-bottom:20px">社区</h1>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
          在 GitHub 上创建社区 →
          <a href="${this._newIssueUrl([CONFIG.labels.inn])}" target="_blank" class="btn btn-sm">创建</a>
        </p>
        ${inns.length === 0 ? Components.empty('暂无社区').outerHTML :
          inns.map(inn => `
            <div class="card">
              <div class="card-title"><a href="#/inn/${inn.number}">${inn.name}</a></div>
              <div class="card-meta">
                <span class="user-badge">
                  <img src="${inn.user.avatar_url}" width="16" height="16" style="border-radius:50%" alt="">
                  <a href="#/user/${inn.user.login}">${inn.user.login}</a>
                </span>
                <span>${Components.timeAgo(inn.created_at)}</span>
              </div>
              <div class="card-body">${Components.parseMarkdown(inn.body.slice(0, 200))}</div>
            </div>
          `).join('')
        }
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
      const label = `inn:${innSlug}`;
      const searchQuery = `label:${CONFIG.labels.post}+label:${label}`;
      const searchResult = await API.searchIssues(searchQuery);
      const posts = (searchResult.items || []).map(i => this._issueToPost(i));
      const html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <div>
            <h1 style="font-size:20px;font-weight:700">${innName}</h1>
            ${innIssue.body ? `<p style="color:var(--text-secondary);font-size:14px">${Components.parseMarkdown(innIssue.body)}</p>` : ''}
          </div>
          <a href="#/post/new?inn=${innSlug}" class="btn btn-sm btn-primary">发帖</a>
        </div>
        ${posts.length === 0 ? Components.empty('此社区暂无帖子').outerHTML :
          posts.map(p => this._renderPostCard(p)).join('')
        }
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
      bold: ['**', '**'],
      italic: ['*', '*'],
      heading: ['## ', ''],
      link: ['[', '](url)'],
      image: ['', ''],
      code: ['`', '`'],
      codeblock: ['```\n', '\n```'],
      list: ['- ', ''],
      quote: ['> ', ''],
    };

    const [pre, post] = inserts[tag] || ['', ''];
    const placeholder = tag === 'link' ? '链接文字' : tag === 'image' ? '图片描述' : '';

    if (tag === 'image') {
      const url = prompt('输入图片链接（或提交后在 GitHub 拖拽上传）：', 'https://');
      if (!url) return;
      const imgMd = `![${sel || '图片'}](${url})`;
      ta.value = text.slice(0, start) + imgMd + text.slice(end);
      ta.selectionStart = ta.selectionEnd = start + imgMd.length;
      ta.focus();
      return;
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
        const selected = slug === preInn ? ' selected' : '';
        return `<option value="${slug}"${selected}>${i.title}</option>`;
      }).join('');

      const html = `
        <h1 style="font-size:20px;font-weight:700;margin-bottom:20px">发新帖</h1>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
          填写完成后将跳转到 GitHub 提交，可在 GitHub 页面拖拽上传图片和文件。
        </p>
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
              <button type="button" class="md-btn" data-tag="codeblock" title="代码块">```</button>
              <button type="button" class="md-btn" data-tag="list" title="列表">•</button>
              <button type="button" class="md-btn" data-tag="quote" title="引用">&gt;</button>
              <span class="md-hint">📋 粘贴图片自动存储 · 全功能编辑在 GitHub</span>
            </div>
            <textarea id="post-content" class="form-input" required maxlength="65000"
              placeholder="写下你的内容..." style="min-height:220px"></textarea>
          </div>
          <button type="submit" class="btn btn-primary">提交到 GitHub →</button>
        </form>
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
        tags.split(',').map(t => t.trim()).filter(t => t).forEach(t => {
          labels.push(`tag:${t.toLowerCase().replace(/\s+/g, '-')}`);
        });

        const url = this._newIssueUrl(labels, title, content);
        window.open(url, '_blank');
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
      const html = `
        <div class="post-header">
          <h1>${post.title}</h1>
          <div class="post-meta">
            <span class="user-badge">
              <img src="${post.user.avatar_url}" width="20" height="20" style="border-radius:50%" alt="">
              <a href="#/user/${post.user.login}">${post.user.login}</a>
            </span>
            <span>${new Date(post.created_at).toLocaleString()}</span>
            <span>💬 ${post.comments}</span>
            ${post.labels.map(l => `<span class="tag">${l.replace('tag:', '')}</span>`).join('')}
          </div>
        </div>
        <div class="post-content">${Components.parseMarkdown(post.body)}</div>
        <div style="text-align:center;margin:20px 0">
          <a href="${issueUrl}" target="_blank" class="btn btn-primary">在 GitHub 上回复</a>
        </div>
        <h2 style="font-size:16px;font-weight:600;margin-bottom:16px">评论（${comments.length}）</h2>
        <div id="comments">
          ${comments.length === 0 ? Components.empty('暂无评论，在 GitHub 上回复').outerHTML :
            comments.map(c => `
              <div class="comment">
                <div class="comment-header">
                  <img src="${c.user.avatar_url}" alt="">
                  <a href="#/user/${c.user.login}"><strong>${c.user.login}</strong></a>
                  <span>${Components.timeAgo(c.created_at)}</span>
                </div>
                <div class="comment-body">${Components.parseMarkdown(c.body)}</div>
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

  async soloList(params) {
    this._setContent(Components.loading().outerHTML);
    try {
      const uid = params.uid || '';
      const issues = await API.listIssues(CONFIG.labels.solo);
      const solos = issues.map(i => ({
        number: i.number,
        body: i.body || '',
        user: i.user,
        created_at: i.created_at,
        likes: i.reactions ? i.reactions['+1'] || 0 : 0,
      }));
      const targetUser = uid ? await API.getUser(uid).catch(() => null) : null;
      const filteredSolos = targetUser
        ? solos.filter(s => s.user.login === targetUser.login)
        : solos;
      const html = `
        <div class="user-profile">
          ${targetUser
            ? `<img src="${targetUser.avatar_url}" alt=""><h1>${targetUser.name || targetUser.login}</h1><div class="user-login">@${targetUser.login}</div>`
            : '<h1>全部动态</h1>'}
        </div>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
          发动态 →
          <a href="${this._newIssueUrl([CONFIG.labels.solo])}" target="_blank" class="btn btn-sm">发动态</a>
        </p>
        <h2 style="font-size:16px;font-weight:600;margin-bottom:16px">动态</h2>
        ${filteredSolos.length === 0 ? Components.empty('暂无动态').outerHTML :
          filteredSolos.map(s => `
            <div class="card">
              <div class="card-meta">
                <span class="user-badge">
                  <img src="${s.user.avatar_url}" width="16" height="16" style="border-radius:50%" alt="">
                  <a href="#/user/${s.user.login}">${s.user.login}</a>
                </span>
                <span>${Components.timeAgo(s.created_at)}</span>
              </div>
              <div class="card-body">${Components.parseMarkdown(s.body)}</div>
              <span style="font-size:12px;color:var(--text-secondary)">👍 ${s.likes}</span>
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
      const userSolos = await API.searchIssues(`author:${params.login}+label:${CONFIG.labels.solo}`);
      const posts = (userIssues.items || []).map(i => this._issueToPost(i));
      const html = `
        <div class="user-profile">
          <img src="${user.avatar_url}" alt="">
          <h1>${user.name || user.login}</h1>
          <div class="user-login">@${user.login}</div>
          ${user.bio ? `<div class="user-bio">${user.bio}</div>` : ''}
          ${user.company ? `<div class="user-bio">🏢 ${user.company}</div>` : ''}
          ${user.location ? `<div class="user-bio">📍 ${user.location}</div>` : ''}
          <div class="user-stats">
            <div class="user-stat"><div class="num">${posts.length}</div><div class="label">帖子</div></div>
            <div class="user-stat"><div class="num">${userSolos.total_count || 0}</div><div class="label">动态</div></div>
            <div class="user-stat"><div class="num">${user.public_repos || 0}</div><div class="label">仓库</div></div>
          </div>
          <a href="${this._githubUrl('')}" target="_blank" class="btn btn-sm" style="margin-left:8px">仓库主页</a>
        </div>
        <h2 style="font-size:16px;font-weight:600;margin:20px 0 12px">最近的帖子</h2>
        ${posts.slice(0, 5).length === 0 ? Components.empty('暂无帖子').outerHTML :
          posts.slice(0, 5).map(p => this._renderPostCard(p)).join('')
        }
        ${posts.length > 5 ? `<a href="#/search?author=${params.login}" class="btn btn-sm">查看全部</a>` : ''}
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
      <h1 style="font-size:20px;font-weight:700;margin-bottom:20px">搜索</h1>
      <form id="search-form" class="search-bar">
        <input id="search-input" class="form-input" placeholder="搜索帖子..." value="${query}">
        <button type="submit" class="btn btn-primary">搜索</button>
      </form>
      <div id="search-results"></div>
    `);
    document.getElementById('search-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const q2 = document.getElementById('search-input').value;
      window.location.hash = `#/search?q=${encodeURIComponent(q2)}`;
    });
    if (query || author) {
      const resultsEl = document.getElementById('search-results');
      resultsEl.innerHTML = Components.loading().outerHTML;
      try {
        let searchQuery = `repo:${CONFIG.owner}/${CONFIG.repo}+label:${CONFIG.labels.post}`;
        if (query) searchQuery += `+${query}`;
        if (author) searchQuery += `+author:${author}`;
        const res = await API.searchIssues(searchQuery);
        const posts = (res.items || []).map(i => this._issueToPost(i));
        resultsEl.innerHTML = posts.length === 0
          ? Components.empty('未找到结果').outerHTML
          : posts.map(p => this._renderPostCard(p)).join('');
      } catch (e) {
        resultsEl.innerHTML = Components.error(e.message).outerHTML;
      }
    }
  },
};
