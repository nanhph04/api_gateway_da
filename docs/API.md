API GATEWAY ROUTES
==================

Media membership routes:

```text
POST  /api/media/channels/:channelId/membership-review/request
GET   /api/media/memberships/me
PATCH /api/media/memberships/:membershipId/auto-renew
```

`POST /api/media/channels/:channelId/membership-review/request` is a protected
route for creators to request admin approval before opening channel membership.
It forwards unchanged to media-service and injects authenticated user headers.
The request has no body. When the channel meets membership eligibility,
media-service moves `membershipReviewStatus` to `pending`.

`PATCH /api/media/memberships/:membershipId/auto-renew` is a protected route.
The gateway forwards it unchanged to media-service and injects the internal
gateway secret plus authenticated user headers.

Auth session stream:

```text
GET /api/auth/session/events
```

`GET /api/auth/session/events` is a protected SSE route.

- Public gateway path: `/api/auth/session/events`
- Internal target path: `/api/identity/auth/session/events`
- Requires `Authorization: Bearer <accessToken>`
- Gateway validates the bearer token, injects authenticated user headers, and
  proxies the response as a stream without response buffering.

Expected event used by FE when admin suspends an account:

```text
event: session.revoked
data: {"reason":"ACCOUNT_SUSPENDED","message":"Tài khoản đã bị vô hiệu hóa. Vui lòng kiểm tra email để biết lý do.","revokedAt":"2026-05-17T00:00:00.000Z"}
```
