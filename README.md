# Patrol Unit Simulator

A browser-based teaching simulation of a hybrid human–robot patrol unit: a drone, a ground robot and a sensor mast (the machines), operators and a commander (the people). Participants configure sensors and patrol routes, judge detection reports, decide what to act on, and compare their unit's picture with the ground truth.

Two ways to run it, from the same simulation code:

| Version | How participants use it | Needs |
|---|---|---|
| **Single file** (`index.html`) | One laptop per group, all roles at one screen | Nothing: open the file, or the GitHub Pages site |
| **Classroom server** (`server/`) | Everyone on their own laptop: operators judge reports and send them to the commander, who decides; the facilitator runs all groups at once | A small Node server (for example on Render) |

## Classroom server

```
npm start            # node server/server.js, port 8080 (or $PORT)
```

- Open the site, choose **Start a new class** (facilitator). Share the class code.
- Participants open the same site, enter the code, their group name and their role.
- The facilitator moves all groups through Setup → Mission → Gap → Debrief, starts and pauses the mission, and sees the leaderboard.
- No accounts and no personal data: only group names. Class state is kept in memory and cleared after 12 hours or on a restart.

### Deploy on Render

`render.yaml` describes the service. In Render: **New → Blueprint**, connect this repository, select the branch named in `render.yaml`, apply. Health check: `/health`.

## Single file

`index.html` is generated, do not edit it by hand:

```
npm run build        # node tools/build_single.js: single/single.html + server/core.js + server/public/views.js
```

## Layout

```
server/core.js           simulation core (no DOM), shared by everything
server/public/views.js   sensor views (what each sensor returns, from its platform)
server/public/play.html  classroom client (all roles)
server/server.js         classroom server (Node >= 18, no dependencies)
single/single.html       template for the single-file version
tools/build_single.js    builds index.html
test/class_flow.js       end-to-end check against a running server
```
