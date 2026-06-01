# API GATEWAY ROUTES

Media channel image uploads:

```text
POST  /api/media/me/channel/avatar
POST  /api/media/me/channel/banner
```

Both routes are protected multipart upload routes. The gateway forwards them
unchanged to media-service and injects the internal gateway secret plus
authenticated user headers. Media-service uploads the object to
`MINIO_PUBLIC_BUCKET` and returns permanent public `avatarUrl`/`bannerUrl`
values; FE renders those URLs directly.

Gateway media proxy allows these multipart bodies up to `12mb` so the
media-service limits can apply: avatar file max `5MB`, banner file max `10MB`.

Identity profile avatar uploads:

```text
POST  /api/user/users/profile/avatar/upload-url
POST  /api/user/users/profile/avatar/complete
```

Both routes are protected identity-service routes exposed through `/api/user/*`.
The gateway rewrites them to `/api/identity/user/*`, validates the bearer token,
and injects authenticated user headers.

FE flow:

1. Call `upload-url` to receive `uploadUrl`, `objectKey`, `publicUrl`, and
   upload headers.
2. Upload the image directly to `uploadUrl` with HTTP `PUT`.
3. Call `complete` with `objectKey`.
4. Render `avatarUrl` from the complete/profile/session response directly.

`avatarUrl` is a permanent public MinIO URL stored by identity-service. Gateway
does not expose old direct profile avatar upload routes such as
`PUT /api/user/users/profile/avatar` or `PATCH /api/user/users/profile/avatar`.

Media video thumbnails:

Video list/detail/metadata responses expose `thumbnailUrl` as a permanent
public MinIO object URL. Gateway no longer exposes
`GET /api/media/videos/:id/thumbnail` or
`GET /api/media/studio/videos/:id/thumbnail`; FE should render `thumbnailUrl`
directly.

Media studio metadata suggestions:

```text
POST /api/media/studio/videos/metadata-suggestions
```

This is a protected media-service route. The gateway forwards it unchanged,
validates the bearer token, and injects authenticated user headers plus the
media internal gateway secret. Clients should send `Authorization: Bearer
<accessToken>` and the JSON request body documented in media-service API docs.

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
