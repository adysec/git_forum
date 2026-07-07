const App = {
  _page: 1,

  async init() {
    Auth.init();
    this._renderHeader();
    this._setupAuthModal();

    await API.ensureInitialLabels();

    Router.on('/', (p) => this.home(p));
    Router.on('/inn/list', (p) => this.innList(p));
    Router.on('/inn/:iid', (p) => this.innView(p));
    Router.on('/post/new', (p) => this.postNew(p));
    Router.on('/post/:iid/:pid', (p) => this.postView(p));
    Router.on('/solo/user/:uid', (p) => this.soloList(p));
    Router.on('/user/:login', (p) => this.userView(p));
    Router.on('/search', (p) => this.search(p));

    Router.init();
  },

  _renderHeader() {
    const header = document.querySelector('header .header-inner');
    if (!header) return;
    const user = Auth.user;
    const authArea = header.querySelector('.auth-area');
    if (user) {
      authArea.innerHTML = '';
      const userInfo = Components.e('div', { className: 'user-info' },
        Components.e('a', { href: `#/user/${user.login}` },
          Components.avatar(user.avatar_url, 24),
          ' ' + user.login,
        ),
      );
      if (Auth.isAdmin) {
        userInfo.appendChild(Components.e('span', { style: 'color:var(--warning);font-size:12px' }, '(admin)'));
      }
      authArea.appendChild(userInfo);
        authArea.appendChild(Components.btn('退出', 'btn-sm', () => Auth.logout()));
    } else {
      authArea.innerHTML = '';
      authArea.appendChild(Components.btn('GitHub 登录', 'btn-sm btn-primary', () => Auth.login().then(() => { this._renderHeader(); Router.navigate('/') })));
    }
  },

  _setupAuthModal() {
    if (document.getElementById('auth-modal')) return;
    const modal = Components.e('div', { id: 'auth-modal', className: 'modal-overlay' },
      Components.e('div', { className: 'modal' },
        Components.e('h2', {}, 'GitHub 身份验证'),
        Components.e('p', {}, '在 GitHub 上输入以下代码完成登录：'),
        Components.e('div', { id: 'auth-code', className: 'code' }, '------'),
        Components.e('p', { id: 'auth-text' }, '或在浏览器打开：'),
        Components.e('a', { id: 'auth-uri', href: '#', target: '_blank' }, 'github.com/login/device'),
        Components.e('p', { style: 'margin-top:16px;font-size:12px;color:var(--text-muted)' }, '等待验证中...'),
      ),
    );
    document.body.appendChild(modal);
  },

  _setContent(html) {
    document.getElementById('content').innerHTML = html;
  },

  async home() {
    this._setContent(Components.loading().outerHTML);
    try {
      this._page = 1;
      const issues = await API.listIssues(CONFIG.labels.post, 1);
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
        ${Auth.isLoggedIn ? '<a href="#/post/new" class="btn btn-primary">发帖</a>' : ''}
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
      const label = `inn:${innName.toLowerCase().replace(/\s+/g, '-')}`;
      const searchQuery = `label:${CONFIG.labels.post}+label:${label}`;
      const searchResult = await API.searchIssues(searchQuery);
      const posts = (searchResult.items || []).map(i => this._issueToPost(i));
      const html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <div>
            <h1 style="font-size:20px;font-weight:700">${innName}</h1>
            ${innIssue.body ? `<p style="color:var(--text-secondary);font-size:14px">${Components.parseMarkdown(innIssue.body)}</p>` : ''}
          </div>
          <a href="#/post/new" class="btn btn-sm btn-primary">发帖</a>
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

  async postNew() {
    if (!Auth.isLoggedIn) {
      this._setContent(Components.error('请先登录').outerHTML);
      return;
    }
    const inns = await API.listIssues(CONFIG.labels.inn).catch(() => []);
    const innOptions = inns.map(i =>
      `<option value="${i.title.toLowerCase().replace(/\s+/g, '-')}">${i.title}</option>`
    ).join('');
    const html = `
      <h1 style="font-size:20px;font-weight:700;margin-bottom:20px">发新帖</h1>
      <form id="post-form">
        <div class="form-group">
          <label>所属社区</label>
          <select id="post-inn" class="form-input" required>
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
          <textarea id="post-content" class="form-input" required maxlength="65000" placeholder="写下你的内容..."></textarea>
        </div>
        <button type="submit" class="btn btn-primary">发布</button>
      </form>
    `;
    this._setContent(html);
    document.getElementById('post-form').addEventListener('submit', async (e) => {
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
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = '发布中...';
      try {
        const issue = await API.createIssue(title, content, labels.slice(0, 50));
        Router.navigate(`/post/${inn || 'general'}/${issue.number}`);
      } catch (err) {
        alert('出错了：' + err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = '发布';
      }
    });
    document.querySelectorAll('.tag-input').forEach(el => {
    });
  },

  async postView(params) {
    this._setContent(Components.loading().outerHTML);
    try {
      const issue = await API.getIssue(params.pid);
      const post = this._issueToPost(issue);
      const comments = await API.listComments(params.pid);
      const user = Auth.user;
      const isAuthor = user && user.login === post.user.login;
      const reactions = post.reactions || {};
      const reactionMap = {
        '+1': { count: reactions['+1'] || 0, emoji: '👍' },
        '-1': { count: reactions['-1'] || 0, emoji: '👎' },
        heart: { count: reactions.heart || 0, emoji: '❤️' },
        laugh: { count: reactions.laugh || 0, emoji: '😄' },
        hooray: { count: reactions.hooray || 0, emoji: '🎉' },
      };
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
        <div class="reactions">
          ${Object.entries(reactionMap).map(([key, r]) =>
            `<button class="reaction-btn" data-reaction="${key}" onclick="App._toggleReaction(${params.pid}, '${key}', this)">${r.emoji} ${r.count}</button>`
          ).join('')}
        </div>
        <div class="post-actions">
          ${isAuthor ? `<button class="btn btn-sm btn-danger" onclick="App._deletePost(${params.pid})">删除</button>` : ''}
        </div>
        <h2 style="font-size:16px;font-weight:600;margin-bottom:16px">评论（${comments.length}）</h2>
        <div id="comments">
          ${comments.length === 0 ? Components.empty('暂无评论').outerHTML :
            comments.map(c => `
              <div class="comment">
                <div class="comment-header">
                  <img src="${c.user.avatar_url}" alt="">
                  <a href="#/user/${c.user.login}"><strong>${c.user.login}</strong></a>
                  <span>${Components.timeAgo(c.created_at)}</span>
                </div>
                <div class="comment-body">${Components.parseMarkdown(c.body)}</div>
                ${user && c.user.login === user.login ?
                  `<div class="comment-actions">
                    <button class="btn btn-sm btn-danger" onclick="App._deleteComment(${c.id}, ${params.pid})">删除</button>
                  </div>` : ''
                }
              </div>
            `).join('')
          }
        </div>
      ${user ? `
        <div class="comment-form">
          <h3 style="font-size:14px;font-weight:600;margin-bottom:8px">发表评论</h3>
          <textarea id="comment-body" placeholder="写下你的评论..." maxlength="65000"></textarea>
          <button class="btn btn-sm btn-primary" onclick="App._postComment(${params.pid})">发表</button>
        </div>
      ` : '<p style="color:var(--text-secondary);font-size:14px"><a href="#" onclick="Auth.login();return false">登录</a>后可评论。</p>'}
      `;
      this._setContent(html);
    } catch (e) {
      this._setContent(Components.error(e.message).outerHTML);
    }
  },

  async _toggleReaction(issueNumber, content, btn) {
      if (!Auth.isLoggedIn) return alert('请先登录');
    try {
      await API.addReaction(issueNumber, content);
      const countSpan = btn.querySelector('.count') || btn;
      const current = parseInt(btn.textContent.match(/\d+/)?.[0] || '0');
      btn.innerHTML = btn.innerHTML.replace(/\d+/, current + 1);
    } catch (e) {
      console.error(e);
    }
  },

  async _postComment(issueNumber) {
    const body = document.getElementById('comment-body').value;
    if (!body.trim()) return;
    try {
      await API.createComment(issueNumber, body);
      Router.navigate(Router.currentPath);
    } catch (e) {
      alert('出错了：' + e.message);
    }
  },

  async _deleteComment(commentId, issueNumber) {
    if (!confirm('确定删除此评论？')) return;
    try {
      await API.deleteComment(commentId);
      Router.navigate(Router.currentPath);
    } catch (e) {
      alert('出错了：' + e.message);
    }
  },

  async _deletePost(issueNumber) {
        if (!confirm('确定删除此帖？')) return;
    try {
      await API.updateIssue(issueNumber, { state: 'closed' });
      Router.navigate('/');
    } catch (e) {
      alert('出错了：' + e.message);
    }
  },

  async soloList(params) {
    this._setContent(Components.loading().outerHTML);
    try {
      const uid = params.uid || Auth.user?.login || '';
      const issues = await API.listIssues(CONFIG.labels.solo);
      const solos = issues.map(i => ({
        number: i.number,
        body: i.body || '',
        user: i.user,
        created_at: i.created_at,
        likes: i.reactions ? i.reactions['+1'] || 0 : 0,
      }));
      const targetUser = uid ? await API.getUser(uid).catch(() => null) : Auth.user;
      const filteredSolos = targetUser
        ? solos.filter(s => s.user.login === targetUser.login)
        : solos;
      const html = `
        <div class="user-profile">
          ${targetUser ? `<img src="${targetUser.avatar_url}" alt=""><h1>${targetUser.name || targetUser.login}</h1><div class="user-login">@${targetUser.login}</div>` : '<h1>全部动态</h1>'}
        </div>
        ${Auth.isLoggedIn ? `
          <form id="solo-form" style="margin-bottom:20px">
            <textarea id="solo-content" class="form-input" style="min-height:80px" placeholder="在想什么？" maxlength="1000"></textarea>
            <button type="submit" class="btn btn-sm btn-primary" style="margin-top:8px">发布</button>
          </form>
        ` : ''}
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
      const soloForm = document.getElementById('solo-form');
      if (soloForm) {
        soloForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const content = document.getElementById('solo-content').value;
          if (!content.trim()) return;
          try {
            await API.createIssue(
              content.slice(0, 80) + (content.length > 80 ? '...' : ''),
              content,
              [CONFIG.labels.solo]
            );
            Router.navigate(`/solo/user/${Auth.user.login}`);
          } catch (err) {
            alert('出错了：' + err.message);
          }
        });
      }
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
      const isOwnProfile = Auth.user && Auth.user.login === params.login;
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
          ${isOwnProfile ? '<a href="#/post/new" class="btn btn-sm btn-primary">发帖</a>' : ''}
          <a href="https://github.com/${user.login}" target="_blank" class="btn btn-sm" style="margin-left:8px">GitHub 主页</a>
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
        const params2 = new URLSearchParams({ q: searchQuery, sort: 'created', order: 'desc' });
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
