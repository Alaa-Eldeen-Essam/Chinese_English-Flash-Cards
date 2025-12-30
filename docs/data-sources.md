# Data Sources

Place raw downloads in `data/raw/`.

## CC-CEDICT (primary)

- Source: https://www.mdbg.net/chinese/export/cedict/
- Suggested file: `cedict_1_0_ts_utf-8_mdbg.txt.gz`

Example download:

```bash
curl -L "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz" \
  -o data/raw/cedict.u8.gz
```

## HSK lists (supplement)

- Example source repo: https://github.com/krmanik/HSK-CSV
- Download per level (adjust the level number):

```bash
curl -L "https://raw.githubusercontent.com/krmanik/HSK-CSV/master/HSK%20Level%201.csv" \
  -o data/raw/hsk1.csv
```

Repeat for levels 2-6 and pass those files to the import script.

## Tatoeba sentences (optional examples)

- Source downloads: https://tatoeba.org/eng/downloads
- Download the sentences export and filter for Chinese (language code `cmn`).

Example (placeholder):

```bash
curl -L "https://downloads.tatoeba.org/exports/sentences.csv" \
  -o data/raw/tatoeba_sentences.csv
```
