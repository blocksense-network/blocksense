import type { QuartzConfig } from 'quartz/cfg';
import * as Plugin from 'quartz/plugins';

const config: QuartzConfig = {
  configuration: {
    pageTitle: 'Blocksense Protocol Specification',
    enableSPA: true,
    enablePopovers: true,
    analytics: { provider: 'plausible' },
    locale: 'en-US',
    baseUrl: 'specification.blocksense.network',
    ignorePatterns: ['private', 'templates', '.obsidian'],
    defaultDateType: 'created',
    theme: {
      fontOrigin: 'googleFonts',
      cdnCaching: true,
      typography: {
        header: 'Inter',
        body: 'Source Sans Pro',
        code: 'IBM Plex Mono',
      },
      colors: {
        lightMode: {
          light: '#fafafa',
          lightgray: '#e5e7eb',
          gray: '#9ca3af',
          darkgray: '#374151',
          dark: '#111827',
          secondary: '#3b82f6',
          tertiary: '#06b6d4',
          highlight: 'rgba(59, 130, 246, 0.15)',
        },
        darkMode: {
          light: '#0f172a',
          lightgray: '#1e293b',
          gray: '#64748b',
          darkgray: '#e2e8f0',
          dark: '#f8fafc',
          secondary: '#60a5fa',
          tertiary: '#22d3ee',
          highlight: 'rgba(96, 165, 250, 0.15)',
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({ priority: ['frontmatter', 'filesystem'] }),
      Plugin.Latex({ renderEngine: 'katex' }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: 'github-light',
          dark: 'github-dark',
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: 'shortest' }),
      Plugin.Description(),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
        rssTitle: 'Blocksense Protocol Specification Updates',
        rssFullHtml: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.NotFoundPage(),
    ],
  },
};

export default config;
