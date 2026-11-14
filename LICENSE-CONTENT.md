# Content License and Attribution

This repository mixes code and content from different sources, each under its own terms.

| Content | Location | License / terms |
|---|---|---|
| Website code (HTML, CSS, JavaScript) | `index.html`, `rocling2026/index.html`, `stone/index.html`, `assets/` | [MIT License](LICENSE) |
| Paper PDF (ROCLING 2026) | `rocling2026/paper.pdf` | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Paper PDF (STONE, ISCSLP 2026) | `stone/paper.pdf` | © the authors, all rights reserved (see below) |
| Synthetic audio | `rocling2026/audio/` | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Rating data (aggregated scores) | `rocling2026/data.json` (score fields) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Sentence texts (Han-ji, Tâi-lô) | `rocling2026/data.json` (`hanji`, `tailo`) | SuíSiann Dataset text terms (see below) |
| Human recordings | `rocling2026/audio_human/`, `stone/audio/` | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| Tone predictions and reliability statistics | `stone/data.json` | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

## Paper

`rocling2026/paper.pdf` is the authors' version of *Fantastic Taiwanese Hokkien Corpora and Where
to Find Them: Bootstrapping Low-Resource Speech and Text via Off-the-Shelf LLMs and TTS*
(ROCLING 2026), hosted here until the proceedings appear in the ACL Anthology. In line with the
[ACL Anthology copyright policy](https://aclanthology.org/faq/copyright/), which applies the
Creative Commons Attribution 4.0 International License to materials from 2016 onward, it is shared
under CC BY 4.0.

`stone/paper.pdf` is the authors' version of *STONE: Soft-Label Tone Classification for Taiwanese
Hokkien via CTC-Guided Contrastive Prototypes on Self-Supervised Models* (ISCSLP 2026). It is
posted here for reading;
copyright remains with the authors and no license is granted beyond that.

## Sentence texts

The Han-ji and Tâi-lô texts come from the [SuíSiann Dataset](https://suisiann-dataset.ithuan.tw/)
(version 0.2.1, `SuiSiann.csv`, columns `漢字` and `羅馬字`). They are reproduced **without any
changes**, including the original spacing and punctuation. In line with the SuíSiann text license,
they are shown here only as a speech-synthesis research demonstration. Copyright remains with the
original authors.

## Synthetic speech

The clips in `rocling2026/audio/` were generated with **Google Gemini 3.1 Flash TTS** from the
SuíSiann texts above, under three input conditions:

- `han`: Han-ji only
- `tl`: Tâi-lô only
- `both`: Han-ji + Tâi-lô

The files are the original MP3 outputs (160 kbps, 24 kHz, mono), renamed only, with no re-encoding
or loudness processing. Use of the generated speech is subject to Google's terms of service.

## Human recordings

The three recordings in `rocling2026/audio_human/` come from the
[SuíSiann Dataset](https://suisiann-dataset.ithuan.tw/) (version 0.2.1) and are licensed under
**CC BY-SA 4.0**.

| File | Sentence ID | Original file |
|---|---|---|
| `rocling2026/audio_human/SuiSiann_0511_human.mp3` | SuiSiann_0511 | `ImTong/SuiSiann_0511.wav` |
| `rocling2026/audio_human/SuiSiann_3264_human.mp3` | SuiSiann_3264 | `ImTong/SuiSiann_3264.wav` |
| `rocling2026/audio_human/SuiSiann_0376_human.mp3` | SuiSiann_0376 | `ImTong/SuiSiann_0376.wav` |

- The original WAV files (48 kHz, 24-bit, mono) were converted to MP3 (160 kbps, 48 kHz, mono).
  The content was not edited and no loudness normalization was applied.
- These are the same files that were played to raters in the listening test.
- As adaptations under CC BY-SA 4.0, these MP3 files remain under **CC BY-SA 4.0**. The other
  licenses in this repository do not apply to them.
- All other SuíSiann recordings are available from the
  [SuíSiann website](https://suisiann-dataset.ithuan.tw/).

The five recordings in `stone/audio/` also come from the SuíSiann Dataset (version 0.2.1) and are
licensed under **CC BY-SA 4.0**. They are the original WAV files (48 kHz, 24-bit, mono), copied
without editing, trimming, or re-encoding; the per-syllable playback on the demo page only seeks
within these files.

| File | Sentence ID | Original file |
|---|---|---|
| `stone/audio/SuiSiann_0310.wav` | SuiSiann_0310 | `ImTong/SuiSiann_0310.wav` |
| `stone/audio/SuiSiann_2876.wav` | SuiSiann_2876 | `ImTong/SuiSiann_2876.wav` |
| `stone/audio/SuiSiann_2812.wav` | SuiSiann_2812 | `ImTong/SuiSiann_2812.wav` |
| `stone/audio/SuiSiann_0382.wav` | SuiSiann_0382 | `ImTong/SuiSiann_0382.wav` |
| `stone/audio/SuiSiann_2441.wav` | SuiSiann_2441 | `ImTong/SuiSiann_2441.wav` |

## STONE tone predictions

`stone/data.json` holds the STONE classifier's output for the five recordings: per-syllable
position category, citation tone, lawful tones, top-3 predicted tones with scores, CTC times, and a
downsampled waveform for display, plus per-category reliability over 300 SuíSiann sentences.
It contains no transcript text: the SuíSiann transcript license permits use in speech synthesis
only, so the STONE demo shows tones as numbers and never shows the sentences themselves.

## Ratings

Scores come from the listening test in *Fantastic Taiwanese Hokkien Corpora and Where to Find Them*
(ROCLING 2026): 10 native Taiwanese Hokkien speakers rated each clip blind on a 1–5 scale for
pronunciation, naturalness, and accent. Only aggregate statistics (mean, standard deviation, number
of ratings) are published; no rater information or individual ratings are included.

## Acknowledgments

We thank Chien-Ying Li for the careful expert annotation of the translation outputs, and the ten
native Taiwanese listeners who participated in the speech evaluation. We are grateful to the
National Center for High-performance Computing (NCHC) of the National Institutes of Applied
Research (NIAR), Taiwan, for providing the computational and storage resources used in this work.
This work was supported by the Ministry of Education (MOE) of Taiwan under the project Taiwan
Centers of Excellence in Artificial Intelligence, through the NTU Artificial Intelligence Center of
Research Excellence.
