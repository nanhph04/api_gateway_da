import { Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import express from 'express';
import request from 'supertest';
import { RateLimitMiddleware } from './rate-limit.middleware';

describe('RateLimitMiddleware', () => {
  const playbackTokenSecret = 'test-playback-secret';
  let warnSpy: jest.SpyInstance;

  const createPlaybackToken = (payload: {
    userId: string;
    videoId: string;
  }) => {
    const encodedPayload = Buffer.from(
      JSON.stringify({
        ...payload,
        scope: 'stream',
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
    ).toString('base64url');
    const signature = createHmac('sha256', playbackTokenSecret)
      .update(encodedPayload)
      .digest('base64url');

    return `${encodedPayload}.${signature}`;
  };

  beforeAll(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockClear();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  const buildApp = () => {
    const configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const configs: Record<string, unknown> = {
          PLAYBACK_TOKEN_SECRET: 'test-playback-secret',
          'rateLimit.userService': {
            windowMs: 60_000,
            max: 1,
          },
          'rateLimit.identitySessionProfile': {
            windowMs: 60_000,
            max: 1,
          },
          'rateLimit.mediaService': {
            windowMs: 60_000,
            max: 1,
          },
          'rateLimit.mediaPlayback': {
            windowMs: 60_000,
            max: 2,
          },
          'rateLimit.mediaStreamManifest': {
            windowMs: 60_000,
            max: 2,
          },
          'rateLimit.mediaStreamSegment': {
            windowMs: 60_000,
            max: 2,
          },
        };

        return configs[key] ?? defaultValue;
      }),
    };

    const middleware = new RateLimitMiddleware(configService as never);
    const app = express();

    app.use((req, res, next) => {
      middleware.use(req, res, next);
    });
    app.get('/api/auth/session/profile', (_req, res) => {
      res.status(200).json({ ok: true });
    });
    app.get('/api/media/categories', (_req, res) => {
      res.status(200).json({ ok: true });
    });
    app.get('/api/media/me/videos/:id/play', (_req, res) => {
      res.status(200).json({ ok: true });
    });
    app.get('/api/media/stream/:videoId/master.m3u8', (_req, res) => {
      res.status(200).json({ ok: true });
    });
    app.get('/api/media/stream/:videoId/segments/:segment', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    return app;
  };

  it('limits repeated cookie-auth session profile requests from the same cookie', async () => {
    const app = buildApp();

    await request(app)
      .get('/api/auth/session/profile')
      .set('Cookie', 'refresh_token=session-a')
      .expect(200);

    await request(app)
      .get('/api/auth/session/profile')
      .set('Cookie', 'refresh_token=session-a')
      .expect(429);
  });

  it('does not share cookie-auth rate limit counters across different cookies', async () => {
    const app = buildApp();

    await request(app)
      .get('/api/auth/session/profile')
      .set('Cookie', 'refresh_token=session-a')
      .expect(200);

    await request(app)
      .get('/api/auth/session/profile')
      .set('Cookie', 'refresh_token=session-b')
      .expect(200);
  });

  it('uses a separate playback limiter from generic media routes', async () => {
    const app = buildApp();

    await request(app).get('/api/media/categories').expect(200);
    await request(app).get('/api/media/categories').expect(429);

    await request(app).get('/api/media/me/videos/video-1/play').expect(200);
    await request(app).get('/api/media/me/videos/video-1/play').expect(200);
    await request(app).get('/api/media/me/videos/video-1/play').expect(429);
  });

  it('does not share segment limits across different valid stream tokens from the same IP', async () => {
    const app = buildApp();
    const tokenA = createPlaybackToken({
      userId: 'user-a',
      videoId: 'video-1',
    });
    const tokenB = createPlaybackToken({
      userId: 'user-b',
      videoId: 'video-1',
    });

    await request(app)
      .get('/api/media/stream/video-1/segments/segment-0001.ts')
      .query({ token: tokenA })
      .expect(200);
    await request(app)
      .get('/api/media/stream/video-1/segments/segment-0002.ts')
      .query({ token: tokenA })
      .expect(200);
    await request(app)
      .get('/api/media/stream/video-1/segments/segment-0001.ts')
      .query({ token: tokenB })
      .expect(200);
  });

  it('limits repeated segment requests with the same valid stream token', async () => {
    const app = buildApp();
    const token = createPlaybackToken({ userId: 'user-a', videoId: 'video-1' });

    await request(app)
      .get('/api/media/stream/video-1/segments/segment-0001.ts')
      .query({ token })
      .expect(200);
    await request(app)
      .get('/api/media/stream/video-1/segments/segment-0002.ts')
      .query({ token })
      .expect(200);

    const response = await request(app)
      .get('/api/media/stream/video-1/segments/segment-0003.ts')
      .query({ token })
      .expect(429);

    expect(response.body.path).toContain('token=[redacted]');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('token=[redacted]'),
    );
  });

  it('shares IP fallback limits for invalid and missing stream tokens', async () => {
    const app = buildApp();
    const invalidToken = `${createPlaybackToken({
      userId: 'user-a',
      videoId: 'video-1',
    })}-invalid`;

    await request(app)
      .get('/api/media/stream/video-1/segments/segment-0001.ts')
      .query({ token: invalidToken })
      .expect(200);
    await request(app)
      .get('/api/media/stream/video-1/segments/segment-0002.ts')
      .expect(200);
    await request(app)
      .get('/api/media/stream/video-1/segments/segment-0003.ts')
      .query({ token: invalidToken })
      .expect(429);
  });
});
