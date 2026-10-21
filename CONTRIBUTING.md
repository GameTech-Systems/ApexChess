# Contributing to Apex Chess

Thank you for helping test and shape the game. Please read this page and the [Code of Conduct](CODE_OF_CONDUCT.md) first.

## Current status

The project is in its foundation stage. **Outside code and documentation pull requests are not being accepted yet**, because the [CLA](CLA.md) is still being finalized. Rule proposals, playtest feedback, balance reports, and bug reports are welcome now.

## Ways to help

- **Propose or debate rules** in [Discussions](https://github.com/GameTech-Systems/ApexChess/discussions).
- **File structured proposals and reports** through the [issue templates](https://github.com/GameTech-Systems/ApexChess/issues/new/choose): rule proposal, setup report, balance report, bug.
- **Playtest** once a build is available, and report which ruleset (id and version) you used.
- **Submit code or docs** once pull requests open (see below).

## What we do not accept

Art, piece or board designs, lore, story, characters, names, logos, and other creative material. Those are reserved (see [NOTICE](NOTICE)), and pull requests that add them will be closed. Ideas for rules and setups are welcome as proposals and reports.

## Contributor License Agreement

Before any pull request can be merged, you must agree to the [CLA](CLA.md). Until automation is set up, do this by ticking the CLA box in the pull request template and writing this sentence in the pull request description:

> I have read the Apex Chess Contributor License Agreement and I agree to its terms.

Proposals and reports posted in Discussions and Issues are treated as Contributions under the CLA (see CLA section 8).

## Rule changes need a proposal

Any change to a parameter default, option list, or ruleset needs a linked proposal and follows the process in [Governance](docs/GOVERNANCE.md). Do not change an Official ruleset in a pull request. Official rulesets are immutable, and changes ship as new versions.

## Pull request basics (once open)

- Keep changes small and focused, and explain why.
- Add or update tests. Every rule parameter is tested at its default and at each option.
- Do not commit secrets, personal information, or unreleased creative material.
- Do not add dependencies licensed under GPL or AGPL without discussing it first.
