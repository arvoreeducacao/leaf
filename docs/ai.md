## AI

The editor's AI is born **off** and switches itself on when a key exists in the
environment — there is no separate flag. Each person puts **their own** key in
`.env.local`, the same way they already do with the database:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

That alone is enough: with no `LEAF_AI_MODEL`, the model is `claude-sonnet-5`.
The rest is optional:

| Variable | What for |
|---|---|
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | The key. The presence of one of them is what switches the AI on |
| `LEAF_AI_PROVIDER` | `anthropic` or `openai`, when both keys live in the same `.env` |
| `LEAF_AI_MODEL` | Changes the model. Required on OpenAI, which has no default here |
| `LEAF_AI_BASE_URL` | Points at a compatible gateway instead of the provider's API |
| `LEAF_AI_MAX_OUTPUT_TOKENS` | Output ceiling per answer (default 8192) |

Anyone who sets no key at all keeps the editor they always had: no AI item in
`/`, no button on the formatting toolbar, no route answering.

**The key never reaches the browser.** The editor talks to `POST /api/ai`, and it
is the server that calls the provider. The route requires a session, requires
edit permission on the document sent in the request body, and caps 20 calls per
minute per person; anyone who can only view or comment gets a 403 and never sees
the AI on screen.

What the AI writes enters as a suggestion in the open document — in
collaboration, on a fork of the `Y.Doc`, so nobody else sees the draft before its
time. Accept applies it, undo discards it, and version history is still the
safety net.

