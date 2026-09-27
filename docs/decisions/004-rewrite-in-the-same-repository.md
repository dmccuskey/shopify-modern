# ADR 004: Rewrite in the Same Repository, Keeping v1 as a Tag and a Branch

**Status:** Accepted

## Context

The repository had 152 stars and 32 forks in September 2026, with no commits since June 2017, and it still gains stars about once a month. Those stars and the links to it from old blog posts and the Stack Overflow question ["Using vue.js in Shopify liquid templates"](https://stackoverflow.com/questions/43505094/using-vue-js-in-shopify-liquid-templates) are the project's audience. A new repository would start with none of them.

v2 shares no code with v1 ([ADR 001](001-islands-in-a-liquid-first-theme.md) to [ADR 003](003-monorepo-of-packages-and-example-theme.md)). v1 doesn't install on current Node (webpack 2, Babel 6, no lockfile), so it can't be updated in place either.

People who find the repository through its stars clone the default branch, `master`. While v2 is being built, a half-finished v2 there would serve them worse than v1.

## Decision

- v2 is a full overhaul in this repository, keeping its name and URL.
- The last v1 commit is tagged `v1` and kept on the branch `legacy/v1`.
- Until the v2.0 release, v2 is developed on a long-lived `v2` branch. Feature branches start from `v2` and merge back into it with `git merge --no-ff`. `master` keeps v1, with one added line in its README pointing to the `v2` branch.
- At the v2.0 release, `v2` is merged into `master` once with `--no-ff` and tagged `v2.0.0`. The `v2` branch is then deleted, and development goes back to short-lived branches on `master`.
- The v2 README links to the `v1` tag for readers arriving from old posts.

The branch is named `v2` rather than `release-v2` because a release branch usually means a short stabilization period, not weeks of development.

## Consequences

- The stars, forks, issues and inbound links stay with the project.
- v1 stays reachable by tag and branch, for anyone who needs the 2017 code.
- `master` shows v1 until the release, so v2 has less visibility while it's built.
- A long-lived integration branch departs from the usual short-lived branch workflow; it ends at the v2.0 release (see [Branches](../development.md#branches)).
