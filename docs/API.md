API GATEWAY ROUTES
==================

Media membership routes:

```text
GET   /api/media/memberships/me
PATCH /api/media/memberships/:membershipId/auto-renew
```

`PATCH /api/media/memberships/:membershipId/auto-renew` is a protected route.
The gateway forwards it unchanged to media-service and injects the internal
gateway secret plus authenticated user headers.
