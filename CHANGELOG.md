# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [0.7.0] - 2026-03-26

### Added

- feat: task url,suggestions,icons,overflow

### Fixed

- fix(client): sort board columns alphabetically by member name

### Changed

- chore: roadmap
- chore: fix docker build

## [0.6.0] - 2026-03-26

### Added

- feat(team-board): add app-release notifications, member sorting, and changelog automation

### Changed

- chore: add tsbuildinfo to gitignore
- chore: delete tsbuildinfo

## [0.5.0] - 2026-03-26

### Added
- Release notifications sent to all users on WebSocket connection
- Live cursor sharing with per-user opt-out setting
- Upvote/remove-upvote actions on tasks
- Org invitation system with accept/decline flows
- Notification bell with unread indicator in the UI
- WebSocket presence tracking per org

### Fixed
- Cursor broadcast now skips users who have opted out of live cursors
- Invitation backfill on login for users who already have a pending invite

### Changed
- Improved request logging middleware
- TypeScript build info excluded from version control
