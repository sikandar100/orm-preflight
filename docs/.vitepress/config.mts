import { readdirSync } from 'node:fs'
import { defineConfig } from 'vitepress'

// Every rule page in docs/rules (core) and docs/rules/typeorm (adapter), for the sidebar.
const rulesDir = new URL('../rules/', import.meta.url)
const core = readdirSync(rulesDir).filter((f) => f.endsWith('.md') && f !== 'README.md')
const typeorm = readdirSync(new URL('typeorm/', rulesDir)).filter((f) => f.endsWith('.md'))
const item = (dir: string) => (file: string) => {
  const id = `${dir}${file.replace(/\.md$/, '')}`
  return { text: id, link: `/rules/${id}` }
}

export default defineConfig({
  title: 'orm-preflight',
  description: 'Preflight safety checks for TypeORM migrations.',
  base: '/orm-preflight/',
  cleanUrls: true,
  // The maintainer's local spec must never be published.
  srcExclude: ['SPEC.md'],
  rewrites: { 'rules/README.md': 'rules/index.md' },
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide' },
      { text: 'AI agents', link: '/agents' },
      { text: 'Rules', link: '/rules/' },
      { text: 'JSON output', link: '/json-output' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting started', link: '/guide' },
          { text: 'Use with AI agents', link: '/agents' },
        ],
      },
      {
        text: 'Rules',
        items: [
          { text: 'All rules', link: '/rules/' },
          ...core.map(item('')),
          ...typeorm.map(item('typeorm/')),
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'JSON output', link: '/json-output' },
          { text: 'Privacy', link: '/privacy' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/sikandar100/orm-preflight' }],
    search: { provider: 'local' },
    editLink: {
      pattern: 'https://github.com/sikandar100/orm-preflight/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
})
