---
layout: home

hero:
  name: orm-preflight
  text: Catch dangerous TypeORM migrations before you merge
  tagline: Data loss, table locks, and deploy breakage, found in review instead of in production.
  actions:
    - theme: brand
      text: Get started
      link: /guide
    - theme: alt
      text: See the rules
      link: /rules/

features:
  - title: Finds real hazards
    details: A column that TypeORM drops and re-adds, an index build that blocks writes, a rename that breaks the running app. Each finding says what happens, why, and the safe way to do it.
  - title: Nothing to set up
    details: No database, no network, and your migrations are never run. It reads the files, so it is safe on pull requests from forks.
  - title: Checked against the real thing
    details: Every locking claim is verified on PostgreSQL 14 to 18, and every rule is tested on migrations written by real TypeORM.
---
