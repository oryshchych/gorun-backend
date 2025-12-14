import request from 'supertest';
import app from '../app';

describe('Health Check', () => {
  it('should return 200 and health status', async () => {
    const response = await request(app).get('/api/health').expect(200);

    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
    expect(typeof response.body.uptime).toBe('number');
  });

  it('should have correct response structure', async () => {
    const response = await request(app).get('/api/health').expect(200);

    expect(response.body).toMatchObject({
      status: expect.any(String),
      timestamp: expect.any(String),
      uptime: expect.any(Number),
    });
  });
});
