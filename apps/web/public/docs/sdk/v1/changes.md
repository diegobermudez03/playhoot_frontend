# Changes

A change is one JSON document. It applies all or nothing, on the revision you read.

- **Recommended:** **edits** change files the project already has: each one replaces a piece of text with another. They are the default way to change an existing file: small, cheap and easy to review.
- **Files** hold new files, or files you rewrite substantially, each with its complete content.
- **Delete** removes files.

A path goes in only one of the three (several edits of one file are fine).

```json
{
  "format": "playhoot.project-change.v1",
  "base_revision": 4,
  "edits": [
    { "path": "server/game.ts", "find": "const GOAL = 20;", "replace": "const GOAL = 30;" },
    { "path": "server/game.ts", "find": "const DURATION_MS = 30000;", "replace": "const DURATION_MS = 45000;" }
  ],
  "files": [
    { "path": "shared/scoring.ts", "content": "export const bonusFor = (taps: number) => Math.floor(taps / 10);\n" }
  ],
  "delete": ["server/old-helpers.ts"],
  "idempotency_key": "3f9c2a7e-6b1d-4c58-9e0a-2d7f41b8c653"
}
```

- `base_revision`: the revision you read. Required.
- `edits`: applied in order, on the content of `base_revision` (a later edit of a file sees the earlier ones). `find` is text copied exactly from the file, spaces and line breaks included, with enough surrounding lines to appear **once**; `replace` takes its place. To replace every occurrence (a rename), add `"all": true`. Edits never create files.
- `files`: new files or substantial rewrites, each with its whole content. Files not named anywhere stay as they are.
- `delete`: paths to remove (they must exist).
- `idempotency_key`: a new random string per change. Sending the same document again with the same key answers what it answered the first time.
- Field names are snake_case; `edits`, `files` and `delete` may be left out when empty. Give the person the raw JSON, or inside one code block; nothing else around it.

## Sending it

- Without HTTP: give it to the person, who pastes it in **Cambios de mi IA** (id `ai`).
- With HTTP: `POST <link>/changes` with the document as the body.

## Answers

| Answer | Meaning | What to do |
|---|---|---|
| `200 {"outcome":"applied","revision":N}` | A new revision N. With edits, `diffs` has each edited file's unified diff (cut at 8 KiB, `truncated`). | Check the diffs say what you meant, then wait for the build (`building.md`). |
| `200 {"outcome":"unchanged","revision":N}` | Every file would stay the same; no revision. | Nothing. |
| `409 revision_conflict` with `current_revision` | The game changed since you read it. | Read the link again and redo the change on the new revision. |
| `422 invalid_change` with `diagnostics` | The document breaks the project rules. | Fix what each diagnostic says. |
| `409 not_editable` | The game is published with no new version open. | Ask the owner to create a new version. |
| `409 idempotency_conflict` | The key was used for another change. | Use a new key. |
| `400` | Unknown `format`, missing `base_revision` or key, broken JSON. | Fix the document. |

A diagnostic is `{"path","code","message"}`, plus `"edit"` (its index in `edits`, from 0) when it is about an edit. Codes: `invalid_path`, `path_not_allowed`, `duplicate_path`, `not_found`, `required_file`, `invalid_utf8`, `file_too_large`, `too_many_files`, `project_too_large`, `empty_change`; for edits `edit_not_found` (`find` is not in the file: read it again and copy the text exactly), `edit_ambiguous` (`find` appears more than once: add surrounding lines, or `all` if you meant every one) and `invalid_edit` (empty `find`). Rejected attempts also appear in the link's "Recent attempts", so you can learn why a pasted change failed.

## Restoring

Going back to an earlier revision makes a new revision with that revision's files and assets; history is never rewritten.

```json
{ "revision": 2, "base_revision": 4, "idempotency_key": "b2e7d1c0-5a43-4f6e-8c19-7a0d3e95f214" }
```

POST it to `<link>/restore`. It answers like a change. Restore only to recover from damage; the current revision is the game.
