import { Logger } from '@nestjs/common';
import express from 'express';
import request from 'supertest';
import { RateLimitMiddleware } from './rate-limit.middleware';

describe('RateLimitMiddleware', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  const buildApp = () => {
    const configService = {
      get: jest.fn((key: string) => {
        const configs: Record<string, { windowMs: number; max: number }> = {
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
        };

        return configs[key];
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
});
