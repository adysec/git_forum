# Freedom Forum (GitHub Edition)

A community forum powered by **GitHub Issues**, **GitHub Pages**, and **GitHub OAuth**.

No server needed — everything runs on GitHub's infrastructure.

## Architecture

| Component | Technology |
|-----------|-----------|
| Frontend | Vanilla JS SPA hosted on **GitHub Pages** |
| Database | **GitHub Issues** (structured via labels) |
| Auth | **GitHub OAuth** (Device Flow) |
| Search | **GitHub Search API** |
| Storage | GitHub Issue body + raw file hosting |

### Data Model

| Entity | GitHub Mapping |
|--------|---------------|
| **Post** | Issue with `type:post` label |
| **Inn (Community)** | Issue with `type:inn` label |
| **Solo (Microblog)** | Issue with `type:solo` label |
| **Comment** | Issue comment |
| **User** | GitHub Account |
| **Upvote/Downvote** | Issue reactions (👍/👎) |
| **Tags** | Labels with `tag:` prefix |
| **Inn membership** | Labels with `inn:` prefix |

## Setup

### 1. Fork & clone your repo

```bash
git clone https://github.com/YOUR_USERNAME/forum.git
cd forum
```

### 2. Create a GitHub OAuth App

1. Go to **Settings → Developer settings → OAuth Apps → New OAuth App**
2. Application name: `Forum`
3. Homepage URL: `https://YOUR_USERNAME.github.io/forum`
4. Authorization callback URL: `https://YOUR_USERNAME.github.io/forum`
5. Enable **Device Flow** (under OAuth App settings)

### 3. Configure

Edit `config.js`:

```js
const CONFIG = {
  owner: 'YOUR_GITHUB_USERNAME',
  repo: 'forum',
  oauth_client_id: 'YOUR_OAUTH_CLIENT_ID',
  // ...
};
```

### 4. Enable GitHub Pages

1. Go to repo **Settings → Pages**
2. Source: **Deploy from branch**
3. Branch: `main`, folder: `/ (root)`

### 5. Initialize the repo

Create required labels by running this script:

```bash
# Create initial labels via GitHub API
curl -X POST -H "Authorization: token YOUR_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/YOUR_USERNAME/forum/labels \
  -d '{"name":"type:post","color":"fbca04"}'
curl -X POST ... -d '{"name":"type:inn","color":"0e8a16"}'
curl -X POST ... -d '{"name":"type:solo","color":"5319e7"}'
```

Or visit the site once as admin — it creates labels automatically.

## Features

- [x] GitHub OAuth login (Device Flow)
- [x] Create & view posts
- [x] Comment on posts
- [x] Communities (Inns) via labels
- [x] Microblogging (Solos)
- [x] User profiles with GitHub data
- [x] Search via GitHub Issues Search
- [x] Reactions (👍👎❤️😄🎉)
- [x] Pagination
- [x] Responsive design
- [x] Rate limiting handling

## Migrating from Original Freedit

The original freedit used a Rust/Axum backend with fjall (embedded DB). This version replaces:

| Original | New |
|----------|-----|
| Rust/Axum server | Static HTML/JS on GitHub Pages |
| fjall (embedded DB) | GitHub Issues API |
| Local file system | GitHub API + raw content |
| tantivy search | GitHub Issues Search |
| Username/password auth | GitHub OAuth |
| Captcha | GitHub API rate limiting |

## License

MIT
