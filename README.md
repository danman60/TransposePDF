# TransposePDF

Browser chord-sheet editor with three compatible entry paths:

- Create a chart by typing or pasting alternating chord and lyric lines.
- Import an existing PDF chord chart while retaining its extracted layout.
- Import an audio recording to generate a timed, editable draft.
- Optionally paste authoritative lyrics or load a `.txt` lyric sheet while importing audio.

Every result uses the same song model. Charts can be edited, transposed, reset, combined, and exported as PDF.

## Run locally

Requirements: Python 3.12+, FFmpeg/FFprobe, and an `OPENAI_API_KEY` for timed lyric transcription.

```bash
python3 -m pip install -r requirements.txt
export OPENAI_API_KEY=your_key
python3 server.py
```

Open `http://127.0.0.1:8000`.

The server accepts recordings at `POST /api/audio-jobs`. Poll `GET /api/audio-jobs/{job_id}` for status. Uploads are limited to 100 MB and deleted after processing.

Add optional multipart field `authoritativeLyrics` to preserve supplied wording and line breaks. Machine transcription remains stored as timing evidence; it does not replace supplied spelling, punctuation, or capitalization.

## Authoring format

Put a chord row directly above its lyric row. Section labels are optional.

```text
Verse 1
G              C
Amazing grace, how sweet the sound
G                   D
That saved a soul like me
```

## Recording-analysis scope

Current analysis detects major/minor triads locally. Lyrics use OpenAI word timestamps. The result is a draft: chord symbols, lyrics, timing, and confidence remain editable.

This is a local MVP. Production needs an FFmpeg-capable worker, durable job storage, authentication/rate limiting, and managed secrets.

## Related project

The standalone AssemblyAI URL-transcription CLI now lives in the sibling [SoloTranscribeCLI](../SoloTranscribeCLI/README.md) project. Its package and dependencies are independent from this chord-sheet app.
