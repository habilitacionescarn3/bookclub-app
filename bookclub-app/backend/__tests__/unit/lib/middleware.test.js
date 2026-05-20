const { withClubAccess } = require('../../../src/lib/middleware');
const User = require('../../../src/models/user');
const response = require('../../../src/lib/response');

jest.mock('../../../src/models/user');

describe('middleware.withClubAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ADMIN_NOTIFY_EMAIL = 'allowed1@test.com,allowed2@test.com';
  });

  afterEach(() => {
    delete process.env.ADMIN_NOTIFY_EMAIL;
  });

  const mockHandler = jest.fn().mockResolvedValue({ statusCode: 200, body: 'success' });
  const authHeader = { Authorization: 'Bearer token123' };

  it('allows access for user in the allowed email list', async () => {
    const user = { userId: 'u1', email: 'allowed1@test.com', role: 'user' };
    User.getCurrentUser.mockResolvedValue(user);
    User.getById.mockResolvedValue(user);

    const wrapped = withClubAccess(mockHandler);
    const res = await wrapped({ headers: authHeader });

    expect(res.statusCode).toBe(200);
    expect(mockHandler).toHaveBeenCalled();
  });

  it('allows access for user in the allowed email list case-insensitively', async () => {
    const user = { userId: 'u1', email: 'ALLOWED2@TEST.COM', role: 'user' };
    User.getCurrentUser.mockResolvedValue(user);
    User.getById.mockResolvedValue(user);

    const wrapped = withClubAccess(mockHandler);
    const res = await wrapped({ headers: authHeader });

    expect(res.statusCode).toBe(200);
  });

  it('allows access for superadmin regardless of email', async () => {
    const user = { userId: 'u1', email: 'other@test.com', role: 'superadmin' };
    User.getCurrentUser.mockResolvedValue(user);
    User.getById.mockResolvedValue(user);

    const wrapped = withClubAccess(mockHandler);
    const res = await wrapped({ headers: authHeader });

    expect(res.statusCode).toBe(200);
  });

  it('denies access for user not in the allowed email list', async () => {
    const user = { userId: 'u1', email: 'other@test.com', role: 'user' };
    User.getCurrentUser.mockResolvedValue(user);
    User.getById.mockResolvedValue(user);

    const wrapped = withClubAccess(mockHandler);
    const res = await wrapped({ headers: authHeader });

    expect(res.statusCode).toBe(403);
    expect(mockHandler).not.toHaveBeenCalled();
  });
});
