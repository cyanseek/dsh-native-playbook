# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.1] - 2026-08-16

### Added

- Five-stage capability lifecycle with provider-aware operational readiness.
- Version-gated activation planning, activation, verification, deactivation, and automatic rollback APIs.
- First reviewed Tier-1 recipe for official workspace-authorized session full-text search.
- Automatic runtime activation through the existing `native_capability` tool.
- Consumer-install smoke coverage and machine-readable `llms.txt` discovery metadata.

### Changed

- GitHub installations now consume committed prebuilt artifacts without build approval.
- Runtime guidance is intentionally small and prioritizes operational official DSH capabilities.
- English and Chinese READMEs now lead with the one-command DSH journey and real scenarios.

### Removed

- Consumer lifecycle build scripts, including `prepare`.

## [0.1.0] - 2026-08-14

### Added

- Native-first Agent Skill with focused references and more than 15 recipes.
- Official Codex skill-only plugin manifest pointing to the same Skill tree.
- Installable DSH bundle and thin runtime adapter exposing `native_capability`.
- Live runtime availability detection from the calling Agent's visible DSH tools.
- Curated task map covering more than 30 high-value DSH intents.
- Generated official tool and base-profile snapshot pinned to an upstream commit.
- Profile-aware CLI, offline lookup, JSON output, Node API, and safe Skill installer.
- Cross-platform CI and open-source project policies.

[Unreleased]: https://github.com/cyanseek/dsh-native-playbook/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/cyanseek/dsh-native-playbook/compare/v0.1.0...v0.2.1
[0.1.0]: https://github.com/cyanseek/dsh-native-playbook/releases/tag/v0.1.0
