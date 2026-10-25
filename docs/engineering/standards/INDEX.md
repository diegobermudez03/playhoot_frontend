# Engineering Standards

Status: CANONICAL INDEX

This index routes engineers and AI agents to accepted reusable engineering standards for the frontend.

- Load only standards relevant to the current task.
- Absence of a standard does not allow an AI to invent one.
- Use `docs/ai/processes/ENGINEERING_STANDARD.md` to create or change a reusable standard.
- Architecture rules are owned by `ARCHITECTURE.md`; do not duplicate them here.
- Implementation patterns observed in code are not canonical merely because they exist.
- The backend's standards (`../playhoot/docs/engineering/standards/`) govern the backend only. A backend standard may inspire a frontend one, but only through the Engineering Standard process.

| Concern | Standard |
| --- | --- |
| User-facing text: languages, message catalogs, whole-sentence ICU messages, no hardcoded text | `user-facing-text.md` |
| Values from the backend contract: never a closed list, known values handled and a general default for the rest, no protocol error for a new value | `backend-contract-values.md` |
