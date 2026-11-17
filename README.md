# Slate Specs

An ai3 product: architectural specification writing. One HTML file, no server. Takes project input (questionnaires, AI-assisted notes, uploaded finish specs, door hardware and drawing sets), supplies ai3's master boilerplate, and produces a project manual as Word (.docx) and PDF in ai3's format.

Built on the same conventions as STEVE: single-file HTML, vanilla JS, localStorage plus Supabase `app_state` sync.

## Use it

Open `slate-specs.html` (committed build), or serve the repo with GitHub Pages. Settings > paste your Anthropic API key (stored in that browser only). Sign in with your ai3 account to sync.

## Layout

```
src/engine.js        parsing, rendering, numbering, redline/diff, submittals, PDF layout (paginator)
src/docx.js          Word output (headers/footers, bookmarks, links, TOC page fields)
src/seed.js          section catalog, starter sets, master boilerplate, standards seed
src/app.js           shell, views, projects, library, cloud sync
src/sources.inc.js   uploads (finish specs, hardware, drawings), manual import, drag and drop
src/extras.inc.js    issues/compare, submittals, pre-issue check, standards, Word round-trip, Reference projects
src/app.css          ai3 design system (light/dark)
vendor/              supabase-js, fflate and the ai3 diagnostic block, copied from STEVE
build.py             assembles slate-specs.html from the above
test/                unit tests (t1.js) and Playwright smoke tests with a mocked Anthropic API
```

`sources.inc.js` and `extras.inc.js` are spliced into `app.js` at the `/*__SOURCES__*/` and `/*__EXTRAS__*/` markers, so all of it shares one scope.

## Build and test

```
python3 build.py        # writes slate-specs.html
./run-tests.sh          # needs node, python3 + playwright, Google Chrome
```

`slate-specs.html` is committed so the file can be opened or served as is. Rebuild and commit it after changing anything in `src/`.

## Data

- localStorage keys `ss1_*`; theme key `ai3_theme` is shared with the other ai3 tools.
- Supabase `app_state` rows (same project and table as STEVE): `ss_idx` + one `ss_proj_<id>` per project, `ss_archidx` + one `ss_arch_<id>` per reference project, `ss_library`, `ss_settings`. Whole-row, last-write-wins. If the cloud read fails while signed in, nothing uploads until it succeeds.
- Settings > Download backup writes one JSON file with projects, reference projects, library and settings.

## Notes

- The Supabase URL and publishable key are in `src/app.js` (`SB`). The publishable key is meant to be public; access is controlled by the table's row-level security.
- The Anthropic API is called directly from the browser with the user's own key.
- PDF export uses the browser's print dialog (choose Save as PDF). Bookmarks come from headings; Chrome writes them into the PDF.
