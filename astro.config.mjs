import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://anyareese.github.io',
  base: '/dbdcomp-archive',
  integrations: [sitemap()],
});
