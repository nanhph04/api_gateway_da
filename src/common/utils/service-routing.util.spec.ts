import {
  resolveProxyPath,
  resolveRouteManifestEntry,
} from './service-routing.util';

describe('service routing manifest', () => {
  it('matches routes by method and path', () => {
    expect(
      resolveRouteManifestEntry('GET', '/api/media/categories')?.authPolicy,
    ).toBe('public');

    expect(
      resolveRouteManifestEntry('GET', '/api/media/tags')?.authPolicy,
    ).toBe('public');

    expect(
      resolveRouteManifestEntry('POST', '/api/media/admin/categories')
        ?.authPolicy,
    ).toBe('protected');

    expect(
      resolveRouteManifestEntry('POST', '/api/media/admin/tags')?.authPolicy,
    ).toBe('protected');

    expect(
      resolveRouteManifestEntry('GET', '/api/identity/user/admin/users/summary')
        ?.serviceKey,
    ).toBe('identityService');

    expect(
      resolveRouteManifestEntry('GET', '/api/media/admin/channels/summary')
        ?.serviceKey,
    ).toBe('mediaService');

    expect(
      resolveRouteManifestEntry(
        'GET',
        '/api/media/admin/channels?page=1&limit=20',
      )?.serviceKey,
    ).toBe('mediaService');

    expect(
      resolveRouteManifestEntry(
        'GET',
        '/api/media/admin/channels/membership-reviews?status=pending',
      )?.serviceKey,
    ).toBe('mediaService');

    expect(
      resolveRouteManifestEntry(
        'PATCH',
        '/api/media/admin/channels/channel-1/membership-review',
      )?.serviceKey,
    ).toBe('mediaService');

    expect(
      resolveRouteManifestEntry(
        'PATCH',
        '/api/media/admin/channels/channel-1/status',
      )?.serviceKey,
    ).toBe('mediaService');

    expect(
      resolveRouteManifestEntry(
        'GET',
        '/api/media/admin/videos?page=1&limit=20',
      )?.serviceKey,
    ).toBe('mediaService');

    expect(
      resolveRouteManifestEntry(
        'GET',
        '/api/media/admin/videos/summary?period=month',
      )?.serviceKey,
    ).toBe('mediaService');

    expect(
      resolveRouteManifestEntry('GET', '/api/media/admin/videos/video-1')
        ?.serviceKey,
    ).toBe('mediaService');

    expect(
      resolveRouteManifestEntry(
        'GET',
        '/api/media/admin/videos/video-1/preview',
      )?.authPolicy,
    ).toBe('protected');

    expect(
      resolveRouteManifestEntry(
        'PATCH',
        '/api/media/admin/videos/video-1/moderation',
      )?.serviceKey,
    ).toBe('mediaService');
  });

  it('does not route removed media report APIs', () => {
    expect(
      resolveRouteManifestEntry('GET', '/api/media/admin/reports/summary'),
    ).toBeUndefined();
    expect(
      resolveRouteManifestEntry(
        'GET',
        '/api/media/admin/reports?status=pending&page=1&limit=5',
      ),
    ).toBeUndefined();
    expect(
      resolveRouteManifestEntry('POST', '/api/media/videos/video-1/reports'),
    ).toBeUndefined();
    expect(
      resolveRouteManifestEntry(
        'POST',
        '/api/media/channels/channel-1/reports',
      ),
    ).toBeUndefined();
  });

  it('routes public discovery video lists through the current media contract', () => {
    const byCategoryEntry = resolveRouteManifestEntry(
      'GET',
      '/api/media/videos/by-category?category=music&page=1&limit=20',
    );
    const latestEntry = resolveRouteManifestEntry(
      'GET',
      '/api/media/videos/latest?limit=20',
    );
    const rankingEntry = resolveRouteManifestEntry(
      'GET',
      '/api/media/videos/ranking?metric=views&period=week&limit=6',
    );

    expect(byCategoryEntry?.serviceKey).toBe('mediaService');
    expect(byCategoryEntry?.authPolicy).toBe('public');
    expect(byCategoryEntry?.requiresInternalSecret).toBe(false);
    expect(latestEntry?.serviceKey).toBe('mediaService');
    expect(latestEntry?.authPolicy).toBe('public');
    expect(latestEntry?.requiresInternalSecret).toBe(false);
    expect(rankingEntry?.serviceKey).toBe('mediaService');
    expect(rankingEntry?.authPolicy).toBe('public');
    expect(rankingEntry?.requiresInternalSecret).toBe(false);
  });

  it('does not route removed category slug video list endpoint', () => {
    expect(
      resolveRouteManifestEntry(
        'GET',
        '/api/media/categories/music/videos?page=1&limit=20',
      ),
    ).toBeUndefined();
    expect(
      resolveProxyPath(
        'GET',
        '/api/media/categories/music/videos?page=1&limit=20',
      ),
    ).toBe('/api/media/categories/music/videos?page=1&limit=20');
  });

  it('does not make write methods public for public GET resources', () => {
    expect(
      resolveRouteManifestEntry('GET', '/api/media/channels/channel-1')
        ?.authPolicy,
    ).toBe('optional');

    expect(
      resolveRouteManifestEntry('PATCH', '/api/media/me/channel')?.authPolicy,
    ).toBe('protected');

    expect(
      resolveRouteManifestEntry('PATCH', '/api/media/channels/channel-1')
        ?.authPolicy,
    ).toBeUndefined();
  });

  it('routes identity profile avatar uploads through the current public gateway paths', () => {
    const uploadUrlEntry = resolveRouteManifestEntry(
      'POST',
      '/api/user/users/profile/avatar/upload-url',
    );
    const completeEntry = resolveRouteManifestEntry(
      'POST',
      '/api/user/users/profile/avatar/complete',
    );

    expect(uploadUrlEntry?.serviceKey).toBe('identityService');
    expect(uploadUrlEntry?.authPolicy).toBe('protected');
    expect(uploadUrlEntry?.requiresInternalSecret).toBe(false);
    expect(completeEntry?.serviceKey).toBe('identityService');
    expect(completeEntry?.authPolicy).toBe('protected');
    expect(completeEntry?.requiresInternalSecret).toBe(false);
    expect(
      resolveProxyPath('POST', '/api/user/users/profile/avatar/upload-url'),
    ).toBe('/api/identity/user/users/profile/avatar/upload-url');
    expect(
      resolveProxyPath('POST', '/api/user/users/profile/avatar/complete'),
    ).toBe('/api/identity/user/users/profile/avatar/complete');
  });

  it('uses the dedicated session profile rate limit bucket', () => {
    const entry = resolveRouteManifestEntry('GET', '/api/auth/session/profile');

    expect(entry?.serviceKey).toBe('identityService');
    expect(entry?.authPolicy).toBe('cookieAuth');
    expect(entry?.rateLimitBucket).toBe('identitySessionProfile');
  });

  it('uses dedicated media playback rate limit buckets', () => {
    expect(
      resolveRouteManifestEntry('GET', '/api/media/me/videos/video-1/play')
        ?.rateLimitBucket,
    ).toBe('mediaPlayback');
    expect(
      resolveRouteManifestEntry('POST', '/api/media/me/videos/video-1/progress')
        ?.rateLimitBucket,
    ).toBe('mediaProgress');
    expect(
      resolveRouteManifestEntry(
        'POST',
        '/api/media/me/videos/video-1/playback-token/refresh',
      )?.rateLimitBucket,
    ).toBe('mediaPlayback');
    expect(
      resolveRouteManifestEntry('GET', '/api/media/stream/video-1/master.m3u8')
        ?.rateLimitBucket,
    ).toBe('mediaStreamManifest');
    expect(
      resolveRouteManifestEntry(
        'GET',
        '/api/media/stream/video-1/segments/segment-0001.ts',
      )?.rateLimitBucket,
    ).toBe('mediaStreamSegment');
  });

  it('keeps non-playback media routes on the generic media rate limit bucket', () => {
    expect(
      resolveRouteManifestEntry('GET', '/api/media/categories')?.rateLimitBucket,
    ).toBe('mediaService');
  });

  it('does not route removed direct profile avatar upload endpoints', () => {
    expect(
      resolveRouteManifestEntry('PUT', '/api/user/users/profile/avatar'),
    ).toBeUndefined();
    expect(
      resolveRouteManifestEntry('PATCH', '/api/user/users/profile/avatar'),
    ).toBeUndefined();
    expect(resolveProxyPath('PUT', '/api/user/users/profile/avatar')).toBe(
      '/api/user/users/profile/avatar',
    );
    expect(resolveProxyPath('PATCH', '/api/user/users/profile/avatar')).toBe(
      '/api/user/users/profile/avatar',
    );
  });

  it('routes channel image uploads to the protected media service', () => {
    const avatarEntry = resolveRouteManifestEntry(
      'POST',
      '/api/media/me/channel/avatar',
    );
    const bannerEntry = resolveRouteManifestEntry(
      'POST',
      '/api/media/me/channel/banner',
    );

    expect(avatarEntry?.serviceKey).toBe('mediaService');
    expect(avatarEntry?.authPolicy).toBe('protected');
    expect(avatarEntry?.requiresInternalSecret).toBe(true);
    expect(bannerEntry?.serviceKey).toBe('mediaService');
    expect(bannerEntry?.authPolicy).toBe('protected');
    expect(bannerEntry?.requiresInternalSecret).toBe(true);
    expect(resolveProxyPath('POST', '/api/media/me/channel/avatar')).toBe(
      '/api/media/me/channel/avatar',
    );
    expect(resolveProxyPath('POST', '/api/media/me/channel/banner')).toBe(
      '/api/media/me/channel/banner',
    );
  });

  it('routes purchased video requests to the protected media service', () => {
    const entry = resolveRouteManifestEntry(
      'GET',
      '/api/media/me/videos/purchased?page=1&limit=20',
    );

    expect(entry?.serviceKey).toBe('mediaService');
    expect(entry?.authPolicy).toBe('protected');
    expect(entry?.requiresInternalSecret).toBe(true);
    expect(resolveProxyPath('GET', '/api/media/me/videos/purchased')).toBe(
      '/api/media/me/videos/purchased',
    );
  });

  it('routes media purchase requests to the protected media service', () => {
    const videoEntry = resolveRouteManifestEntry(
      'POST',
      '/api/media/videos/video-1/purchase',
    );
    const membershipEntry = resolveRouteManifestEntry(
      'POST',
      '/api/media/channels/channel-1/memberships/tier-1/purchase',
    );

    expect(videoEntry?.serviceKey).toBe('mediaService');
    expect(videoEntry?.authPolicy).toBe('protected');
    expect(videoEntry?.requiresInternalSecret).toBe(true);
    expect(membershipEntry?.serviceKey).toBe('mediaService');
    expect(membershipEntry?.authPolicy).toBe('protected');
    expect(membershipEntry?.requiresInternalSecret).toBe(true);
    expect(resolveProxyPath('POST', '/api/media/videos/video-1/purchase')).toBe(
      '/api/media/videos/video-1/purchase',
    );
    expect(
      resolveProxyPath(
        'POST',
        '/api/media/channels/channel-1/memberships/tier-1/purchase',
      ),
    ).toBe('/api/media/channels/channel-1/memberships/tier-1/purchase');
  });

  it('routes studio video detail requests to the protected media service', () => {
    const entry = resolveRouteManifestEntry(
      'GET',
      '/api/media/studio/videos/video-1',
    );

    expect(entry?.serviceKey).toBe('mediaService');
    expect(entry?.authPolicy).toBe('protected');
    expect(entry?.requiresInternalSecret).toBe(true);
    expect(resolveProxyPath('GET', '/api/media/studio/videos/video-1')).toBe(
      '/api/media/studio/videos/video-1',
    );
  });

  it('routes studio video metadata suggestions to the protected media service', () => {
    const entry = resolveRouteManifestEntry(
      'POST',
      '/api/media/studio/videos/metadata-suggestions',
    );

    expect(entry?.serviceKey).toBe('mediaService');
    expect(entry?.authPolicy).toBe('protected');
    expect(entry?.requiresInternalSecret).toBe(true);
    expect(
      resolveProxyPath('POST', '/api/media/studio/videos/metadata-suggestions'),
    ).toBe('/api/media/studio/videos/metadata-suggestions');
  });

  it('routes media video event streams through the SSE proxy', () => {
    const entry = resolveRouteManifestEntry(
      'GET',
      '/api/media/videos/events/stream',
    );

    expect(entry?.serviceKey).toBe('mediaService');
    expect(entry?.authPolicy).toBe('protected');
    expect(entry?.requiresInternalSecret).toBe(true);
    expect(entry?.streamMode).toBe('sse');
    expect(resolveProxyPath('GET', '/api/media/videos/events/stream')).toBe(
      '/api/media/videos/events/stream',
    );
  });

  it('does not route removed media thumbnail streaming endpoints', () => {
    expect(
      resolveRouteManifestEntry('GET', '/api/media/videos/video-1/thumbnail'),
    ).toBeUndefined();
    expect(
      resolveRouteManifestEntry(
        'GET',
        '/api/media/studio/videos/video-1/thumbnail',
      ),
    ).toBeUndefined();
    expect(resolveProxyPath('GET', '/api/media/videos/video-1/thumbnail')).toBe(
      '/api/media/videos/video-1/thumbnail',
    );
    expect(
      resolveProxyPath('GET', '/api/media/studio/videos/video-1/thumbnail'),
    ).toBe('/api/media/studio/videos/video-1/thumbnail');
  });

  it('keeps thumbnail URLs as public response data, not gateway routes', () => {
    const metadataEntry = resolveRouteManifestEntry(
      'GET',
      '/api/media/videos/video-1/metadata',
    );

    expect(metadataEntry?.serviceKey).toBe('mediaService');
    expect(metadataEntry?.authPolicy).toBe('optional');
    expect(metadataEntry?.requiresInternalSecret).toBe(false);
  });

  it('routes membership auto-renew updates to the protected media service', () => {
    const entry = resolveRouteManifestEntry(
      'PATCH',
      '/api/media/memberships/membership-1/auto-renew',
    );

    expect(entry?.serviceKey).toBe('mediaService');
    expect(entry?.authPolicy).toBe('protected');
    expect(entry?.requiresInternalSecret).toBe(true);
    expect(
      resolveProxyPath(
        'PATCH',
        '/api/media/memberships/membership-1/auto-renew',
      ),
    ).toBe('/api/media/memberships/membership-1/auto-renew');
  });

  it('routes channel membership review requests to the protected media service', () => {
    const entry = resolveRouteManifestEntry(
      'POST',
      '/api/media/channels/channel-1/membership-review-requests',
    );

    expect(entry?.serviceKey).toBe('mediaService');
    expect(entry?.authPolicy).toBe('protected');
    expect(entry?.requiresInternalSecret).toBe(true);
    expect(
      resolveProxyPath(
        'POST',
        '/api/media/channels/channel-1/membership-review-requests',
      ),
    ).toBe('/api/media/channels/channel-1/membership-review-requests');
  });

  it('routes failed upload deletion as a protected media request', () => {
    const deleteFailedEntry = resolveRouteManifestEntry(
      'DELETE',
      '/api/media/studio/videos/video-1/failed-upload',
    );

    expect(deleteFailedEntry?.serviceKey).toBe('mediaService');
    expect(deleteFailedEntry?.authPolicy).toBe('protected');
    expect(deleteFailedEntry?.requiresInternalSecret).toBe(true);
  });

  it('routes resumable video upload lifecycle requests as protected media requests', () => {
    const paths: Array<[string, string]> = [
      ['POST', '/api/media/studio/videos/uploads'],
      ['POST', '/api/media/studio/videos/video-1/uploads/upload-1/part-urls'],
      [
        'POST',
        '/api/media/studio/videos/video-1/uploads/upload-1/parts/3/completed',
      ],
      ['GET', '/api/media/studio/videos/video-1/uploads/upload-1/status'],
      ['POST', '/api/media/studio/videos/video-1/uploads/upload-1/complete'],
      ['POST', '/api/media/studio/videos/video-1/uploads/upload-1/submit'],
      ['DELETE', '/api/media/studio/videos/video-1/uploads/upload-1'],
    ];

    for (const [method, path] of paths) {
      const entry = resolveRouteManifestEntry(method, path);

      expect(entry?.serviceKey).toBe('mediaService');
      expect(entry?.authPolicy).toBe('protected');
      expect(entry?.requiresInternalSecret).toBe(true);
      expect(resolveProxyPath(method, path)).toBe(path);
    }
  });

  it('rewrites namespaced finance routes to the finance service api prefix', () => {
    expect(resolveProxyPath('GET', '/api/finance/wallets/me')).toBe(
      '/api/wallets/me',
    );
    expect(
      resolveProxyPath(
        'GET',
        '/api/finance/deposits/admin/packages?includeInactive=true',
      ),
    ).toBe('/api/deposits/admin/packages?includeInactive=true');
    expect(resolveProxyPath('GET', '/api/finance/wallets/me/')).toBe(
      '/api/wallets/me/',
    );
  });

  it('routes finance health and admin dashboard requests', () => {
    const healthEntry = resolveRouteManifestEntry('GET', '/api/finance/health');
    const dashboardEntry = resolveRouteManifestEntry(
      'GET',
      '/api/finance/admin/dashboard/overview?startDate=2026-05-01',
    );
    const legacyDashboardEntry = resolveRouteManifestEntry(
      'GET',
      '/api/admin/dashboard/overview',
    );

    const identityHealthEntry = resolveRouteManifestEntry(
      'GET',
      '/api/identity/health',
    );
    const mediaHealthEntry = resolveRouteManifestEntry(
      'GET',
      '/api/media/health',
    );

    expect(healthEntry?.serviceKey).toBe('financeService');
    expect(healthEntry?.authPolicy).toBe('public');
    expect(identityHealthEntry?.serviceKey).toBe('identityService');
    expect(identityHealthEntry?.authPolicy).toBe('public');
    expect(identityHealthEntry?.requiresInternalSecret).toBe(false);
    expect(mediaHealthEntry?.serviceKey).toBe('mediaService');
    expect(mediaHealthEntry?.authPolicy).toBe('public');
    expect(mediaHealthEntry?.requiresInternalSecret).toBe(false);
    expect(dashboardEntry?.serviceKey).toBe('financeService');
    expect(dashboardEntry?.authPolicy).toBe('protected');
    expect(legacyDashboardEntry?.serviceKey).toBe('financeService');
    expect(legacyDashboardEntry?.authPolicy).toBe('protected');
  });

  it('does not route removed finance payment APIs', () => {
    expect(
      resolveRouteManifestEntry('POST', '/api/finance/payments'),
    ).toBeUndefined();
    expect(
      resolveRouteManifestEntry('POST', '/api/finance/payments/payment-1'),
    ).toBeUndefined();
    expect(resolveRouteManifestEntry('POST', '/api/payments')).toBeUndefined();
    expect(resolveProxyPath('POST', '/api/finance/payments')).toBe(
      '/api/finance/payments',
    );
    expect(resolveProxyPath('POST', '/api/payments')).toBe('/api/payments');
  });

  it('keeps legacy finance resource aliases unchanged', () => {
    expect(resolveProxyPath('GET', '/api/wallets/me')).toBe('/api/wallets/me');
    expect(resolveProxyPath('POST', '/api/deposits/webhooks/payos')).toBe(
      '/api/deposits/webhooks/payos',
    );
  });

  it('rewrites identity admin user aliases to the identity service prefix', () => {
    expect(resolveProxyPath('GET', '/api/user/admin/users/summary')).toBe(
      '/api/identity/user/admin/users/summary',
    );
    expect(
      resolveProxyPath(
        'GET',
        '/api/user/admin/users?page=1&limit=20&status=suspended',
      ),
    ).toBe('/api/identity/user/admin/users?page=1&limit=20&status=suspended');
    expect(resolveProxyPath('GET', '/api/user/admin/users/user-1')).toBe(
      '/api/identity/user/admin/users/user-1',
    );
    expect(
      resolveProxyPath('PATCH', '/api/user/admin/users/user-1/status'),
    ).toBe('/api/identity/user/admin/users/user-1/status');
    expect(
      resolveProxyPath('GET', '/api/identity/user/admin/users/summary'),
    ).toBe('/api/identity/user/admin/users/summary');
  });

  it('routes studio finance aliases to finance service unchanged', () => {
    const entry = resolveRouteManifestEntry('GET', '/api/studio/wallet/stats');

    expect(entry?.serviceKey).toBe('financeService');
    expect(entry?.authPolicy).toBe('protected');
    expect(resolveProxyPath('GET', '/api/studio/earnings/summary')).toBe(
      '/api/studio/earnings/summary',
    );
  });
});
