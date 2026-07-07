const Components = {
  e(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'className') el.className = v;
      else if (k === 'innerHTML') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null) continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  },

  icon(name) {
    return Components.e('span', { className: 'icon' }, name);
  },

  avatar(url, size = 20) {
    return Components.e('img', { src: url, width: size, height: size, alt: '', loading: 'lazy' });
  },

  userBadge(user) {
    const a = Components.e('a', { href: `#/user/${user.login}`, className: 'user-badge' });
    a.appendChild(this.avatar(user.avatar_url, 16));
    a.appendChild(document.createTextNode(' ' + user.login));
    return a;
  },

  tag(text) {
    return Components.e('span', { className: 'tag' }, text);
  },

  btn(text, cls = '', onClick = null) {
    return Components.e('button', {
      className: `btn ${cls}`.trim(),
      onClick: onClick && (e => { e.preventDefault(); onClick(e) }),
      type: 'button',
    }, text);
  },

  loading() {
    return Components.e('div', { className: 'loading' }, 'Loading...');
  },

  error(msg) {
    return Components.e('div', { className: 'error' }, msg);
  },

  empty(msg = '这里空空的') {
    return Components.e('div', { className: 'empty-state' },
      Components.e('h2', {}, msg),
    );
  },

  pagination(page, hasMore, onPrev, onNext) {
    const div = Components.e('div', { className: 'pagination' });
    if (page > 1) div.appendChild(this.btn('← 上一页', '', onPrev));
    else div.appendChild(this.btn('← 上一页', '', null));
    if (hasMore) div.appendChild(this.btn('下一页 →', '', onNext));
    else div.appendChild(this.btn('下一页 →', '', null));
    div.querySelectorAll('button:disabled')?.forEach(b => b.disabled = true);
    return div;
  },

  parseMarkdown(md) {
    if (!md) return '';
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    html = html
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/######\s+(.+)/g, '<h6>$1</h6>')
      .replace(/#####\s+(.+)/g, '<h5>$1</h5>')
      .replace(/####\s+(.+)/g, '<h4>$1</h4>')
      .replace(/###\s+(.+)/g, '<h3>$1</h3>')
      .replace(/##\s+(.+)/g, '<h2>$1</h2>')
      .replace(/#\s+(.+)/g, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/~~(.+?)~~/g, '<del>$1</del>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
      .replace(/^> (.+)/gm, '<blockquote>$1</blockquote>')
      .replace(/^- (.+)/gm, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    html = '<p>' + html + '</p>';
    return html;
  },

  timeAgo(ts) {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;
    return new Date(ts).toLocaleDateString();
  },
};
