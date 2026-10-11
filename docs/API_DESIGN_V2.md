# Together Listen V2 API Design

## 1. Design Goals

This document defines the external communication interfaces for Together Listen V2.

Goals:

- Separate frontend and backend responsibilities.
- Maintain compatibility during migration.
- Provide clear HTTP and WebSocket contracts.
- Support small-scale multi-room deployment.

## 2. API Layers

The system consists of:

- HTTP API: configuration, metadata, health checks.
- WebSocket API: real-time room interaction.

## 3. HTTP API

### Health Check

GET /api/health

Purpose:

- Server availability check.
- Deployment monitoring.

Response example:

```json
{
  "status": "ok"
}
```

### Room Information

GET /api/rooms/:id

Returns basic room information.

## 4. WebSocket Events

### Room Events

Client actions:

- room:create
- room:join
- room:leave

Server events:

- room:state
- room:member_update

### Playback Events

Client actions:

- playback:play
- playback:pause
- playback:seek
- playback:next

Server events:

- playback:update
- playback:sync

## 5. Synchronization Protocol

Server remains the authoritative source of playback state.

State contains:

- track id
- playing status
- anchor position
- server timestamp

Clients calculate local playback position and periodically correct drift.

## 6. Error Handling

All interfaces should provide:

- error code
- message
- request context

## 7. Future Extensions

Reserved capabilities:

- authentication
- room permissions
- playlist management
- external music providers
