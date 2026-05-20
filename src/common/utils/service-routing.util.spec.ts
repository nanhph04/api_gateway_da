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
      resolveRouteManifestEntry('GET', '/api/media/admin/reports/summary')
        ?.serviceKey,
    ).toBe('mediaService');

    expect(
      resolveRouteManifestEntry(
        'GET',
        '/api/media/admin/reports?status=pending&page=1&limit=5',
      )?.serviceKey,
    ).toBe('mediaService');

    expect(
      resolveRouteManifestEntry(
        'GET',
        '/api/media/admin/videos?page=1&limit=20',
      )?.serviceKey,
    ).toBe('mediaService');

    expect(
      resolveRouteManifestEntry('GET', '/api/media/admin/videos/video-1')
        ?.serviceKey,
    ).toBe('mediaService');

    expect(
      resolveRouteManifestEntry(
        'PATCH',
        '/api/media/admin/videos/video-1/moderation',
      )?.serviceKey,
    ).toBe('mediaService');
  });

  it('routes public discovery video lists through the current media contract', () => {
    const categoryEntry = resolveRouteManifestEntry(
      'GET',
      '/api/media/categories/music/videos?page=1&limit=20',
    );
    const byCategoryEntry = resolveRouteManifestEntry(
      'GET',
      '/api/media/videos/by-category?category=music&page=1&limit=20',
    );
    const latestEntry = resolveRouteManifestEntry(
      'GET',
      '/api/media/videos/latest?limit=20',
    );

    expect(categoryEntry?.serviceKey).toBe('mediaService');
    expect(categoryEntry?.authPolicy).toBe('public');
    expect(categoryEntry?.requiresInternalSecret).toBe(false);
    expect(byCategoryEntry?.serviceKey).toBe('mediaService');
    expect(byCategoryEntry?.authPolicy).toBe('public');
    expect(byCategoryEntry?.requiresInternalSecret).toBe(false);
    expect(latestEntry?.serviceKey).toBe('mediaService');
    expect(latestEntry?.authPolicy).toBe('public');
    expect(latestEntry?.requiresInternalSecret).toBe(false);
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

  it('routes video thumbnail streaming with public and owner access policies', () => {
    const publicEntry = resolveRouteManifestEntry(
      'GET',
      '/api/media/videos/video-1/thumbnail',
    );
    const ownerEntry = resolveRouteManifestEntry(
      'GET',
      '/api/media/studio/videos/video-1/thumbnail',
    );

    expect(publicEntry?.serviceKey).toBe('mediaService');
    expect(publicEntry?.authPolicy).toBe('public');
    expect(publicEntry?.requiresInternalSecret).toBe(false);
    expect(ownerEntry?.serviceKey).toBe('mediaService');
    expect(ownerEntry?.authPolicy).toBe('protected');
    expect(ownerEntry?.requiresInternalSecret).toBe(true);
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
