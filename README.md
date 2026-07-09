# Git Forum

A static community forum powered by **GitHub Issues** + **GitHub Pages**.

Read-only SPA — write operations (post, reply) redirect to GitHub for submission.

## Architecture

| Component | Technology |
|-----------|-----------|
| Frontend | Vanilla JS SPA hosted on GitHub Pages |
| Database | GitHub Issues (structured via labels) |
| Search | GitHub Issues Search API |

### Data Model

| Entity | GitHub Mapping |
|--------|---------------|
| **Post** | Issue with `type:post` label |
| **Community (Inn)** | Issue with `type:inn` label |
| **Comment** | Issue comment |
| **User** | GitHub Account |
| **Tags** | Labels with `tag:` prefix |
| **Community membership** | Labels with `inn:` prefix |

### Labels

Create these labels in your repo:

- `type:post` — forum posts
- `type:inn` — communities
- `type:solo` — microblog (deprecated)

## Setup

### 1. Fork & configure

```bash
git clone https://github.com/YOUR_USERNAME/git_forum.git
cd git_forum
```

Edit `config.js`:

```js
const CONFIG = {
  owner: 'YOUR_GITHUB_USERNAME',
  repo: 'git_forum',
  title: 'Git Forum',
  // ...
};
```

### 2. Enable GitHub Pages

Deploy from `master` branch via `.github/workflows/pages.yml`.

### 3. Create labels

```bash
curl -X POST -H "Authorization: token YOUR_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/YOUR_USERNAME/git_forum/labels \
  -d '{"name":"type:post","color":"fbca04"}'
curl -X POST ... -d '{"name":"type:inn","color":"0e8a16"}'
```

## Features

- [x] Discuz-like forum index (community table + thread list)
- [x] Create posts via GitHub Issue redirect
- [x] Communities (Inns) via labels
- [x] Thread view with user sidebar
- [x] Comment browsing
- [x] Markdown toolbar + image paste
- [x] Search via GitHub Issues Search API
- [x] Pagination
- [x] Responsive dark theme
- [x] Rate limiting handling
- [x] Cloudflare Rocket Loader compatible

## License

MIT
