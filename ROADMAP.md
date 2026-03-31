# Roadmap

- [x] feat: enable task tracker code
- [x] refactor: universal nav bar
  - refactor all of the apps to have a universal nav bar with easy navigation between `/` and the app landing
- [x] refactor: universal settings page
  - add a universal user settings page with one tab for each app, as well as a general settings tab for common across all apps settings
  - the settings page should replace the exam creator database selection bar
  - settings page should replace settings page on team board

Notes:

- ensure all apps correctly use the auth method
- ensure the main routes are: `/` (universal landing), `/login` (single login page redirected to if not authed), `/exam-creator` (base route for everything related to that), `/team-board` (base route for everything related to that), `/task-tracker` (base route for everything related to that), `/settings` (universal settings page for user)
