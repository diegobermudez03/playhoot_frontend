# Templates

A template is a published game whose owner lets others start from it. Starting from one that already plays close to the game agreed with the person costs far less than writing it from the starter project: change its content and settings, not its architecture.

## Finding one

1. **Recommended:** browse first: the templates Playhoot features and the categories (MCP `browse_templates`, `GET <link>/templates`). Each entry is compact: name, description, categories, players, languages, devices. No code.
2. Search when the featured ones do not fit: words, a category and the number of players the game needs (`search_templates`, `GET <link>/templates/search?q=words&category=c&players=n`).
3. **Recommended:** inspect only the two or three best candidates (`inspect_template`, `GET <link>/templates/<template_game_uuid>`): its card, its `brief.json`, the players and commands its build declares, what it lets change as data (`config`: each value's declaration and its `config.json`, `config.md`), and its files with sizes. Compare its brief with the game's brief (`brief.md`).
4. **Recommended:** read only the files you need to decide (`read_template_files`, `GET <link>/templates/<template_game_uuid>/files?path=<path>`), never the whole template.
5. **Required:** when none fits, say so to the person and start from the starter project. Never force a template that plays differently: rewriting its rules costs more than writing them.

**Required:** never start a game from an example of this guide (`examples/`): examples teach the SDK; templates are made to be changed.

## Starting from one

- A new game: `create_game` with `template_game_uuid` (or `"template_game_uuid"` when creating it in Playhoot). Revision 1 is a copy of the template's published version: its files and its uploaded assets.
- A game already started: `use_template` (`POST <link>/template` with `{"template_game_uuid", "base_revision", "idempotency_key"}`). The next revision becomes the template's code and assets, but keeps the game's `notes.md`, `brief.json` and the person's uploads for every asset key the template also declares with the same kind of media. The revision before stays in the history: `restore_revision` brings it back, so abandoning a template never means starting the project again by hand.
- The template is never changed, and its owner keeps it. Its history records where your revision came from (`list_revisions`: kind `template` with `from`).

After starting from one, update `brief.json` to this game (`phase` `foundation`), then change what differs: its configuration first (`config.json`), then code with small edits (`changes.md`).
