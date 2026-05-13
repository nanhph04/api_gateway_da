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

  it('routes draft upload replacement and cancellation as protected media requests', () => {
    const replaceEntry = resolveRouteManifestEntry(
      'POST',
      '/api/media/videos/video-1/replace-upload',
    );
    const cancelEntry = resolveRouteManifestEntry(
      'DELETE',
      '/api/media/videos/video-1/upload',
    );

    expect(replaceEntry?.serviceKey).toBe('mediaService');
    expect(replaceEntry?.authPolicy).toBe('protected');
    expect(replaceEntry?.requiresInternalSecret).toBe(true);
    expect(cancelEntry?.serviceKey).toBe('mediaService');
    expect(cancelEntry?.authPolicy).toBe('protected');
    expect(cancelEntry?.requiresInternalSecret).toBe(true);
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
});
