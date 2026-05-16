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
      resolveRouteManifestEntry(
        'GET',
        '/api/identity/user/admin/users/summary',
      )?.serviceKey,
    ).toBe('identityService');

    expect(
      resolveRouteManifestEntry(
        'GET',
        '/api/media/admin/channels/summary',
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
        'GET',
        '/api/media/admin/reports/summary',
      )?.serviceKey,
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
  });

  it('does not make write methods public for public GET resources', () => {
    expect(
      resolveRouteManifestEntry('GET', '/api/media/channels/channel-1')
        ?.authPolicy,
    ).toBe('optional');

    expect(
      resolveRouteManifestEntry('PATCH', '/api/media/channels/channel-1')
        ?.authPolicy,
    ).toBe('protected');
  });

  it('routes purchased video library requests to the protected media service', () => {
    const entry = resolveRouteManifestEntry(
      'GET',
      '/api/media/videos/library/purchased?page=1&limit=20',
    );

    expect(entry?.serviceKey).toBe('mediaService');
    expect(entry?.authPolicy).toBe('protected');
    expect(entry?.requiresInternalSecret).toBe(true);
    expect(resolveProxyPath('GET', '/api/media/videos/library/purchased')).toBe(
      '/api/media/videos/library/purchased',
    );
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

  it('routes draft upload replacement and cancellation as protected media requests', () => {
    const replaceEntry = resolveRouteManifestEntry(
      'POST',
      '/api/media/videos/video-1/replace-upload',
    );
    const cancelEntry = resolveRouteManifestEntry(
      'DELETE',
      '/api/media/videos/video-1/upload',
    );
    const deleteFailedEntry = resolveRouteManifestEntry(
      'DELETE',
      '/api/media/videos/video-1/failed-upload',
    );

    expect(replaceEntry?.serviceKey).toBe('mediaService');
    expect(replaceEntry?.authPolicy).toBe('protected');
    expect(replaceEntry?.requiresInternalSecret).toBe(true);
    expect(cancelEntry?.serviceKey).toBe('mediaService');
    expect(cancelEntry?.authPolicy).toBe('protected');
    expect(cancelEntry?.requiresInternalSecret).toBe(true);
    expect(deleteFailedEntry?.serviceKey).toBe('mediaService');
    expect(deleteFailedEntry?.authPolicy).toBe('protected');
    expect(deleteFailedEntry?.requiresInternalSecret).toBe(true);
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
    const entry = resolveRouteManifestEntry(
      'GET',
      '/api/studio/wallet/stats',
    );

    expect(entry?.serviceKey).toBe('financeService');
    expect(entry?.authPolicy).toBe('protected');
    expect(resolveProxyPath('GET', '/api/studio/earnings/summary')).toBe(
      '/api/studio/earnings/summary',
    );
  });
});
