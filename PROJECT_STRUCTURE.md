# Project structure (two-layer architecture)

## Layers

| Layer | Folder | Role |
|-------|--------|------|
| **Ticketing Environment Layer** | `/ticket` | Landing, queue, surge simulation, confirmation copy |
| **Authentication Engine Layer** | `/auth` | Motion/voice verification, AI stub, auth UI entry |
| **Controller** | root `app.js` | Listens for events; starts auth; routes to confirmation |

## File layout

```
/ticket
  landing.js     — Event page copy
  queue.js       — Queue + confirmation copy
  surgeEngine.js — Simulated surge; dispatches QUEUE_READY

/auth
  motionAuth.js  — Tilt verification; dispatches MOTION_COMPLETE
  voiceAuth.js   — Voice stub
  aiReasoning.js — Listens to auth events (stub)
  authUI.js      — start() / reset() / isVerified() for controller

app.js           — Controller: ticketing events → start auth → auth complete → confirmation
index.html       — Layout and script tags only
style.css        — Styles
```

## Events (document)

- `QUEUE_STARTED` — surgeEngine (when surge starts)
- `QUEUE_READY` — surgeEngine (when wait ends); controller shows verification and calls `authUI.start()`
- `MOTION_COMPLETE` — motionAuth (when tilt verification succeeds)
- `VOICE_COMPLETE` — voiceAuth (stub; when voice step succeeds)

## Script load order

1. ticket/landing.js  
2. ticket/queue.js  
3. ticket/surgeEngine.js  
4. auth/motionAuth.js  
5. auth/voiceAuth.js  
6. auth/aiReasoning.js  
7. auth/authUI.js  
8. app.js  

## Flow

1. **Buy** → controller shows queue, `surgeEngine.start()`
2. **QUEUE_READY** or **Continue** → controller shows verification, `authUI.start()`
3. User completes motion → motionAuth dispatches `MOTION_COMPLETE`; user clicks **Proceed** → controller checks `authUI.isVerified()`, shows confirmation
4. **Start over** → controller calls `surgeEngine.cancel()`, `authUI.reset()`, shows event
