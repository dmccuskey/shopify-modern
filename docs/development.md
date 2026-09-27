# Development

How to work on shopify-modern v2: branches, and ideas that aren't decided yet. Build and test steps are added here when the repository is scaffolded.

## Branches

The default branch is `master`. Until the v2.0 release it holds the v1 code, because people who find the repository through its stars clone it (see [ADR 004](decisions/004-rewrite-in-the-same-repository.md)).

| Branch or tag | Holds |
|---|---|
| `master` | v1, plus a README line pointing to `v2`, until the v2.0 release |
| `v2` | v2 in development: every v2 change merges here |
| `legacy/v1`, tag `v1` | the last v1 commit (2017), kept for reference |

Each change is made on a short-lived branch named for it, started from `v2`:

```text
feat/<name>    new behavior
fix/<name>     bug fixes
docs/<name>    documentation only
```

A branch holds one change, is tested, and is merged back into `v2` with `git merge --no-ff`, so it stays visible as one merge in the history. CI runs on `v2` and on pull requests into it.

At the v2.0 release, `v2` is merged into `master` once with `--no-ff` and tagged `v2.0.0`, and the `v2` branch is deleted. From then on, branches start from `master` and merge back into it.

## Possible Future Changes

Ideas that are not decided. Each needs discussion and a concrete use case before it is worked on. Decided work is tracked in [GitHub issues](https://github.com/dmccuskey/shopify-modern/issues).

### Write Markup Once

Each island is written twice: as server-rendered fallback markup in Liquid, and as a component ([ADR 001](decisions/001-islands-in-a-liquid-first-theme.md)). A build step could turn simple components into static Liquid fallback markup, so the markup is written once. It's a hard problem (component logic doesn't map onto Liquid in general) and may not work out, so it's research, not a planned feature.
