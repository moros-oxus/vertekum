# @vertekum/ext-token-docs

Notes on tokens and groups — for documentation, for agents, for MCP clients — stored
in `$extensions` where anything that reads a token can read them.

## The note

One key, one note per category:

```jsonc
"color": {
  "text": {
    "$type": "color",
    "$value": "#111111",
    "$extensions": {
      "org.vertekum.docs": {
        "docs": "Body copy on light surfaces. Markdown **is** allowed.",
        "llm": "Prefer this over color.text.raw when summarising."
      }
    }
  }
}
```

The categories are the project's own. Setting a category again replaces its text;
nothing keeps history or authorship, because the file is in git and git keeps both.

## Configuration

```ts
import { tokenDocsExtension } from '@vertekum/ext-token-docs';
import { defineConfig } from '@vertekum/core';

export default defineConfig({
  extensions: [tokenDocsExtension],
  settings: {
    'vtk.token.docs': {
      categories: ['docs', 'llm', 'mcp'],
      default: 'docs',
    },
  },
});
```

| Setting | Value space | Meaning |
| --- | --- | --- |
| `categories` | `string[]` (lower-case, digits, hyphens) | the audiences this project writes for. Each becomes a flag and a key in storage. Default `['docs', 'llm', 'mcp']` |
| `default` | `string` | the category `--comment` writes to. Default `'docs'` |

Declaring the vocabulary is what makes `--dcos` an error instead of a new category
nothing reads. `vertekum describe` reports the configured categories, so an agent can
ask rather than guess.

## Writing a note

While creating or changing a token — one command, no second step:

```bash
vertekum token add color.text "#111111" --type color --comment "Body copy on light surfaces"
vertekum token set color.text --llm "Prefer this when summarising"
```

Afterwards, or for a group:

```bash
vertekum docs set color --docs "Everything under here is brand colour"
vertekum docs show color.text
vertekum docs show color.text --json
vertekum docs remove color.text --category llm
vertekum docs remove color.text            # every note
```

A flag exists per configured category (`--docs`, `--llm`, `--mcp`, …), and `--comment`
writes the default one.

## Reading a note

The key is stable, so a consumer needs no dependency on this package:

```js
const notes = token.$extensions?.['org.vertekum.docs'];
```

From an exporter or another extension, the helper avoids hard-coding it:

```ts
import { docsOf, docsOfNode, DOCS_KEY } from '@vertekum/ext-token-docs';

docsOf(token)?.docs; // notes on a resolved token
docsOfNode(groupNode); // notes on any DTCG node
```

A payload that is not an object of strings reads as absent rather than throwing, so a
hand-edited file cannot break someone else's build.

## Validation

The payload is checked by `vertekum check` against the configured categories: an
unknown category is an error naming the vocabulary the project declares.

## License

Apache-2.0
