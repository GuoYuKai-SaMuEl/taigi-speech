# Taigi Research

Research on Taiwanese Hokkien (Taigi) speech and language technology by Yu-Kai Guo, National Taiwan University.

Website: https://guoyukai-samuel.github.io/taigi-speech/

## Projects

| Project | Venue | Links |
|---|---|---|
| Fantastic Taiwanese Hokkien Corpora and Where to Find Them: Bootstrapping Low-Resource Speech and Text via Off-the-Shelf LLMs and TTS | ROCLING 2026 | [Demo](rocling2026/) · [Paper (PDF)](rocling2026/paper.pdf) |
| STONE: Soft-Label Tone Classification for Taiwanese Hokkien via CTC-Guided Contrastive Prototypes on Self-Supervised Models | Preprint | [Paper (PDF)](stone/paper.pdf) |

## Preview locally

The site is plain HTML, CSS, and JavaScript with no build step. Demo pages load `data.json` with
`fetch`, so open them through a local server rather than as `file://`:

```bash
python -m http.server
```

Then open http://localhost:8000.

## Repository layout

```
index.html            # landing page; projects are listed in the PROJECTS array
sitemap.xml           # page list for search engines (submit in Google Search Console)
assets/style.css      # shared styles
assets/demo.js        # renders results table and audio cards from a page's data.json
rocling2026/          # ROCLING 2026 demo page
  index.html
  paper.pdf           # paper (until it appears in the ACL Anthology)
  data.json           # sentences, audio paths, and aggregated scores
  audio/              # synthetic clips: {sentence_id}_{han|tl|both}.mp3
  audio_human/        # SuíSiann human recordings (CC BY-SA 4.0)
stone/
  paper.pdf           # STONE preprint (paper only, no demo page)
```

## Adding a demo page for a new paper

1. Copy `rocling2026/` to a new folder, e.g. `stone2027/`.
2. Replace the audio files in `audio/` (and `audio_human/` if any).
3. Edit `data.json`:
   - `summary.conditions`: overall mean scores per condition.
   - `sentences`: one entry per sentence with `hanji`, `tailo`, `english` (may be empty),
     `group` (`"featured"` or `"more"`), and `clips` per condition with `audio`, the scores, and
     their standard deviations (`pron`, `pron_sd`, …). Set a clip's `audio` to `null` to show its
     scores without a player.
   - If the new paper uses different conditions or rating aspects, update `CONDITIONS` and
     `ASPECTS` at the top of `assets/demo.js` (or give the page its own script).
4. Edit the new `index.html`: title, authors, venue, paper link, overview, Chinese summary, citation,
   and license notes. Also update the metadata in `<head>`: description, canonical URL, the
   Open Graph tags, and the JSON-LD block.
   For a page without audio samples, drop the `#results`, `#featured`, and `#more` sections and the
   `demo.js` script.
5. Add an entry to the `PROJECTS` array in the root `index.html` (including its `bibtex`, which the
   landing page's BibTeX link copies), a row to the table above, and the new page to `sitemap.xml`.

When a paper's citation changes (e.g. it appears in the ACL Anthology or on arXiv), update its
BibTeX in both places: the `bibtex` field in the root `index.html` and the citation block on the
paper's demo page, if it has one.
6. Update `LICENSE-CONTENT.md` for any new content.

Keep large source files (WAV, original exports) out of the repository. GitHub Pages does not serve
Git LFS files.

## License

- Code: [MIT License](LICENSE).
- Content: the ROCLING 2026 paper PDF, synthetic audio, and rating data are CC BY 4.0; the STONE
  preprint PDF is © the authors, all rights reserved; sentence texts follow the
  SuíSiann text terms. See [LICENSE-CONTENT.md](LICENSE-CONTENT.md).
  The SuíSiann human recordings in `rocling2026/audio_human/` are CC BY-SA 4.0.
