# Claude Pen

CLI that learns your writing style and helps you draft content in your voice.

## The pipeline

```
raw → draft → review → refine → ship
```

You dump messy notes (voice memos from a walk, scattered bullets, whatever) and move through the pipeline until you have a polished article with social posts.

```bash
claude-pen draft notes.md                    # raw → structured draft
claude-pen review draft.md                   # get editorial feedback
claude-pen refine draft.md "make it shorter" # apply changes
claude-pen ship article.md --url https://... # generate social posts
```

Each step is optional. Skip `review` if you're happy. Run `refine` multiple times. The pipeline is yours.

## Quick start

```bash
# 0. clone the repo and link
git clone https://github.com/yourusername/claude-pen.git
cd claude-pen
bun install
bun link  # optional: makes `claude-pen` available globally
cp .env.example .env

# 1. init workspace
claude-pen init

# 2. ingest your existing writing
claude-pen ingest

# 3. analyze your existing writing (builds style guide)
claude-pen analyze

# 4. draft something new
claude-pen draft writing/raw/idea.md
```

## Workspace structure

```
your-project/
├── .claude-pen/
│   ├── config.yaml
│   └── prompts/         # customizable
├── writing/
│   ├── _style_guide.md  # auto-generated
│   ├── import/          # drop files here to ingest
│   ├── raw/             # rough notes
│   ├── drafts/          # work in progress
│   └── content/         # published
│       ├── blog/
│       ├── linkedin/
│       └── twitter/
```

## Commands

| Command   | What it does                                          |
| --------- | ----------------------------------------------------- |
| `init`    | Set up workspace and config                           |
| `ingest`  | Import existing markdown with auto-extracted metadata |
| `analyze` | Generate style guide from your published content      |
| `draft`   | Turn notes into structured drafts                     |
| `review`  | Get improvement suggestions                           |
| `refine`  | Apply edits with custom instructions                  |
| `ship`    | Create LinkedIn/Twitter promotional posts             |
| `clean`   | Delete all drafts                                     |

### Draft

```bash
claude-pen draft notes.md
claude-pen draft --stdin              # read from stdin
pbpaste | claude-pen draft --stdin    # from clipboard
```

### Refine

```bash
claude-pen refine                     # interactive file picker
claude-pen refine draft.md            # uses review file if exists
claude-pen refine draft.md "make it shorter and punchier"  # custom instruction
```

Creates timestamped versions, never overwrites.

### Ship

```bash
claude-pen ship article.md --url https://...
```

Outputs `article-linkedin.md` and `article-twitter.md`.

---

## Roadmap

- [ ] OpenAI / other providers
- [ ] Push to platforms (Medium, Substack, etc.)
- [ ] Set up a simple blog page

Contributions welcome.

## Dev

```bash
bun run src/index.ts [command]  # run from source
bun run typecheck
bun run lint
```

## License

MIT
