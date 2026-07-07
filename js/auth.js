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
    if (!CONFIG.oauth_client_id || CONFIG.oauth_client_id === 'YOUR_GITHUB_OAUTH_CLIENT_ID') {
      alert('请先在 config.js 中配置 oauth_client_id\n\n' +
        '1. 前往 https://github.com/settings/developers\n' +
        '2. 创建 OAuth App，Homepage/Callback URL 均填你的 Pages 地址\n' +
        '3. 在 OAuth App 设置中启用 Device Flow\n' +
        '4. 将 Client ID 填入 config.js 的 oauth_client_id');
      return;
    }
    try {
      const { device_code, user_code, verification_uri, interval } =
        await this._startDeviceFlow();
      this._showCode(user_code, verification_uri);
      const token = await this._pollToken(device_code, interval);
      localStorage.setItem('forum_token', token);
      API.setToken(token);
      this._user = await API.getMe();
      localStorage.setItem('forum_user', JSON.stringify(this._user));
      App._renderHeader();
      location.hash = location.hash;
      return this._user;
    } catch (e) {
      alert('登录失败：' + e.message);
    }
  },

  logout() {
    this._user = null;
    localStorage.removeItem('forum_token');
    localStorage.removeItem('forum_user');
    API.setToken(null);
    Router.navigate('/');
  },

  async _startDeviceFlow() {
    const res = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CONFIG.oauth_client_id,
        scope: 'repo,user',
      }),
    });
    if (!res.ok) throw new Error('设备流认证启动失败');
    return res.json();
  },

  _showCode(userCode, uri) {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    const codeEl = document.getElementById('auth-code');
    const uriEl = document.getElementById('auth-uri');
    if (codeEl) codeEl.textContent = userCode;
    if (uriEl) uriEl.href = uri;
    modal.style.display = 'flex';
  },

  async _pollToken(deviceCode, interval) {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        const res = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: CONFIG.oauth_client_id,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          }),
        });
        const data = await res.json();
        if (data.access_token) {
          document.getElementById('auth-modal').style.display = 'none';
          resolve(data.access_token);
        } else if (data.error === 'authorization_pending') {
          setTimeout(poll, (interval || 5) * 1000);
        } else if (data.error === 'slow_down') {
          setTimeout(poll, (interval || 5) * 1000 + 5000);
        } else {
          reject(new Error(data.error_description || data.error || '认证失败'));
        }
      };
      poll();
    });
  },
};
