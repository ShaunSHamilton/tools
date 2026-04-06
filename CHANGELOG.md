# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [0.10.1] - 2026-04-06

### Other

- refactor(server): remove anyhow, replace with typed errors throughout task_tracker worker

## [0.10.0] - 2026-04-06

### Fixed

- fix(server): refresh github oauth tokens before report generation

### Other

- refactor(server): replace anyhow with typed errors across task_tracker and team_board

## [0.9.0] - 2026-04-01

### Added

- feat: unify organisations across all three apps
- feat(notifications): add report_generated notification type
- feat: add notification system to universal nav

### Fixed

- fix(task-tracker): prefix all api routes with /api
- fix(server): serialize report ids as hex strings in api responses

## [0.8.1] - 2026-04-01

### Fixed

- fix(server): use ObjectId for reports and github_connections _id

## [0.8.0] - 2026-03-31

### Added

- feat(server): enable task-tracker module and wire up workers
- feat: match navbar with app theme
- feat(client): theme nav bar by app colour
- feat(client): add universal settings page
- feat(client): add universal nav bar component
- feat(client): enable task tracker routes and home card
- feat(client): auto-select first org on team board load

### Fixed

- fix(client): highlight current user's board column
- fix(client): use unified auth in task tracker

### Changed

- chore: mark roadmap items as complete

### Other

- refactor(server): consolidate task-tracker github credentials with app credentials
- refactor: remove pdf export feature from task-tracker
- refactor(server): remove postmark email from task-tracker org invites
- refactor(client): replace per-app nav with universal nav bar

## [0.7.1] - 2026-03-30

### Added

- feat: notify task assignees on upvote and suggestion

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
