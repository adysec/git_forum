const Auth = {
  _user: null,

  init() {
    const stored = localStorage.getItem('forum_user');
    const token = localStorage.getItem('forum_token');
    if (stored && token) {
      this._user = JSON.parse(stored);
      API.setToken(token);
    }
  },

  get user() { return this._user },

  get isLoggedIn() { return !!this._user },

  get isAdmin() {
    return this._user && CONFIG.adminUsers.includes(this._user.login);
  },

  async login() {
    this._showTokenDialog();
  },

  async loginWithToken(token) {
    token = token.trim();
    if (!token) return;
    try {
      API.setToken(token);
      const user = await API.getMe();
      localStorage.setItem('forum_token', token);
      localStorage.setItem('forum_user', JSON.stringify(user));
      this._user = user;
      return user;
    } catch (e) {
      API.setToken(null);
      throw e;
    }
  },

  logout() {
    this._user = null;
    localStorage.removeItem('forum_token');
    localStorage.removeItem('forum_user');
    API.setToken(null);
    Router.navigate('/');
  },

  _showTokenDialog() {
    const old = document.getElementById('token-dialog');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'token-dialog';
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div class="modal">
        <h2>GitHub 登录</h2>
        <p style="font-size:13px;text-align:left">
          GitHub OAuth 无法在纯静态页面中直接使用，
          需要改用 Personal Access Token：
        </p>
        <ol style="text-align:left;font-size:13px;color:var(--text-secondary);margin:12px 0 12px 20px">
          <li>点击下方按钮前往 Token 生成页面</li>
          <li>勾选 <b>repo</b> 和 <b>user</b> 权限，生成</li>
          <li>复制 Token 粘贴到输入框，点击登录</li>
        </ol>
        <a id="token-generate-btn" href="https://github.com/settings/tokens/new?description=git_forum&scopes=repo,user"
           target="_blank" class="btn btn-sm" style="margin-bottom:12px;display:inline-flex">
          生成 Token →
        </a>
        <input id="token-input" type="password" class="form-input"
          placeholder="粘贴 Token..." style="margin-bottom:12px;text-align:center" autofocus>
        <div style="display:flex;gap:8px;justify-content:center">
          <button id="token-submit" class="btn btn-primary">登录</button>
          <button id="token-cancel" class="btn">取消</button>
        </div>
        <p id="token-error" style="color:var(--danger);font-size:13px;margin-top:8px;display:none"></p>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('token-submit').onclick = async () => {
      const input = document.getElementById('token-input');
      const error = document.getElementById('token-error');
      const btn = document.getElementById('token-submit');
      btn.disabled = true;
      btn.textContent = '验证中...';
      error.style.display = 'none';
      try {
        await this.loginWithToken(input.value);
        overlay.remove();
        App._renderHeader();
        location.hash = location.hash;
      } catch (e) {
        error.textContent = '令牌无效：' + e.message;
        error.style.display = 'block';
        btn.disabled = false;
        btn.textContent = '登录';
      }
    };
    document.getElementById('token-cancel').onclick = () => overlay.remove();
    document.getElementById('token-input').onkeydown = (e) => {
      if (e.key === 'Enter') document.getElementById('token-submit').click();
    };
  },
};
