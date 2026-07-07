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
      alert('令牌无效，请检查：\n' + e.message);
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
        <p style="text-align:left;font-size:13px">
          使用 GitHub Personal Access Token 登录：
        </p>
        <ol style="text-align:left;font-size:13px;color:var(--text-secondary);margin:8px 0 8px 20px">
          <li>前往 <a href="https://github.com/settings/tokens" target="_blank">github.com/settings/tokens</a></li>
          <li>生成 Token，勾选 <b>repo</b> 和 <b>user</b> 权限</li>
          <li>复制 Token 粘贴到下方输入框</li>
        </ol>
        <input id="token-input" type="password" class="form-input"
          placeholder="粘贴你的 GitHub Token..."
          style="margin-bottom:12px;text-align:center"
          autofocus>
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
        this._onLogin();
      } catch {
        error.textContent = '令牌无效，请重新生成';
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

  _onLogin() {
    App._renderHeader();
    location.hash = location.hash;
  },
};
