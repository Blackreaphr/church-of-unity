const { resolve } = require('path');
const path = require('path');
const fs = require('fs');

module.exports = {
  // Serve assets from '/assets' in dev without Vite publicDir root-mapping warnings
  // We disable publicDir and mount a tiny middleware to serve files from ./assets at /assets/*
  publicDir: false,
  plugins: [
    {
      name: 'serve-static-assets-dir',
      configureServer(server) {
        const assetsRoot = resolve(__dirname, 'assets');
        server.middlewares.use((req, res, next) => {
          try {
            const url = req.url || '';
            // Dev-only clean URLs for forum routes: /forum/<slug>(/?) -> /forum/<slug>.html
            if (url.startsWith('/forum/') && !/\.[a-z0-9]+(\?.*)?$/i.test(url)) {
              const pathOnly = url.replace(/[?#].*$/, '');
              const trimmed = pathOnly.endsWith('/') ? pathOnly.slice(0, -1) : pathOnly;
              req.url = trimmed + '.html' + (url.slice(pathOnly.length) || '');
              return next();
            }
            if (!url.startsWith('/assets/')) return next();
            const rel = url.slice('/assets/'.length);
            const filePath = path.join(assetsRoot, rel);
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              const ext = path.extname(filePath).toLowerCase();
              const type = ext === '.css'
                ? 'text/css'
                : ext === '.svg'
                  ? 'image/svg+xml'
                  : ext === '.js'
                    ? 'application/javascript'
                    : undefined;
              if (type) res.setHeader('Content-Type', type);
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          } catch {}
          next();
        });
      }
    }
  ],
  build: {
    // Transpile to older JS so optional chaining/nullish coalescing are removed
    target: 'es2017',
    cssTarget: 'es2017',
    // Also tell esbuild to transpile down
    // (Vite uses esbuild under the hood for transforms)
    minify: 'esbuild',
    // Avoid surprises with very new JS constructs
    // esbuildTarget is respected via build.target, but keep explicit config patterns minimal
    // Avoid injecting the modulepreload polyfill to keep CSP happy
    modulePreload: { polyfill: false },
    polyfillModulePreload: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        foundations: resolve(__dirname, 'foundations.html'),
        startHere: resolve(__dirname, 'start-here.html'),
        catechism: resolve(__dirname, 'catechism.html'),
        catechismGod: resolve(__dirname, 'catechism-god.html'),
        catechismCreation: resolve(__dirname, 'catechism-creation.html'),
        catechismHumanVocation: resolve(__dirname, 'catechism-human-vocation.html'),
        catechismGraceFreedom: resolve(__dirname, 'catechism-grace-freedom.html'),
        catechismDeathHope: resolve(__dirname, 'catechism-death-hope.html'),
        divineLaw: resolve(__dirname, 'divine-law.html'),
        divineLawExtended: resolve(__dirname, 'divine-law-extended.html'),
        chaosOrder: resolve(__dirname, 'chaos-order.html'),
        fateDestiny: resolve(__dirname, 'fate-destiny.html'),
        heavenHellJourney: resolve(__dirname, 'heaven-hell-journey.html'),
        namesOfGod: resolve(__dirname, 'names-of-god.html'),
        textsLibrary: resolve(__dirname, 'texts-library.html'),
        textsLibraryCatholic: resolve(__dirname, 'texts-library-catholic.html'),
        inquiryForum: resolve(__dirname, 'inquiry-forum.html'),
        practice: resolve(__dirname, 'practice.html'),
        sermons: resolve(__dirname, 'sermons.html'),
        glossary: resolve(__dirname, 'glossary.html'),
        condemnation: resolve(__dirname, 'condemnation.html'),
        condemnation2: resolve(__dirname, 'condemnation-2.html'),
        condemnation3: resolve(__dirname, 'condemnation-3.html'),
        about: resolve(__dirname, 'about.html'),
        forum: resolve(__dirname, 'forum.html'),
        forumWelcome: resolve(__dirname, 'forum/welcome.html'),
        forumStart: resolve(__dirname, 'forum-start.html'),
        forumGuidelines: resolve(__dirname, 'forum/guidelines.html'),
        forumGuidelinesTop: resolve(__dirname, 'forum-guidelines.html'),
        forumFAQ: resolve(__dirname, 'forum/faq.html'),
        forumHelp: resolve(__dirname, 'forum/help.html'),
        forumHelpTop: resolve(__dirname, 'forum-help.html'),
        forumIntroductions: resolve(__dirname, 'forum/introductions.html'),
        forumAnnouncements: resolve(__dirname, 'forum/announcements.html'),
        forumAnnouncementsTop: resolve(__dirname, 'forum-announcements.html'),
        forumLifeDeath: resolve(__dirname, 'forum/life-and-death-questions.html'),
        forumPrayerReflections: resolve(__dirname, 'forum/prayer-and-reflections.html'),
        forumPrayerReflectionLightInDarkness: resolve(__dirname, 'forum/prayer-reflection-light-in-darkness.html'),
        forumPrayerReflectionQuietTrust: resolve(__dirname, 'forum/prayer-reflection-quiet-trust.html'),
        forumStudyGuideLectio: resolve(__dirname, 'forum/study-guide-lectio-divina.html'),
        forumStudyGuideExamen: resolve(__dirname, 'forum/study-guide-examen.html'),
        forumStudyGuideRule: resolve(__dirname, 'forum/study-guide-rule-of-life.html'),
        forumFeed: resolve(__dirname, 'forum-feed.html'),
        forumFeedLatest: resolve(__dirname, 'forum-feed/latest/index.html'),
        forumFeedStudyGuides: resolve(__dirname, 'forum-feed/study-guides/index.html'),
        forumNew: resolve(__dirname, 'forum/new.html'),
        forumPost: resolve(__dirname, 'forum/post.html'),
        moderation: resolve(__dirname, 'moderation.html'),
        philosophy: resolve(__dirname, 'philosophy.html'),
        philosophy2: resolve(__dirname, 'philosophy-2.html'),
        purgatory: resolve(__dirname, 'purgatory.html'),
        essayTen: resolve(__dirname, 'essays/ten-commandments.html'),
        essayProvFree: resolve(__dirname, 'essays/providence-and-freedom.html'),
        guideExamen: resolve(__dirname, 'guides/examen.html'),
        guideLectio: resolve(__dirname, 'guides/lectio-divina.html'),
        guideRule: resolve(__dirname, 'guides/rule-of-life.html'),
        guideExamenStandalone: resolve(__dirname, 'guide-examen.html'),
        guideLectioStandalone: resolve(__dirname, 'guide-lectio-divina.html'),
        guideRuleStandalone: resolve(__dirname, 'guide-rule-of-life.html'),
        notFound: resolve(__dirname, '404.html'),
      },
    },
  },
};



