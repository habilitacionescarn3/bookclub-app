const { handler } = require('../../../../src/handlers/clubs/inviteMembers');
const BookClub = require('../../../../src/models/bookclub');
const User = require('../../../../src/models/user');
const { sendClubInvite } = require('../../../../src/lib/notification-service');

jest.mock('../../../../src/models/bookclub');
jest.mock('../../../../src/models/user');
jest.mock('../../../../src/lib/notification-service');

describe('clubs.inviteMembers handler', () => {
  beforeEach(() => jest.clearAllMocks());

  const authHeader = { Authorization: 'Bearer token123' };
  const currentUser = { userId: 'user-1', name: 'Alice' };

  it('successfully invites valid emails and sends invitations', async () => {
    User.getCurrentUser.mockResolvedValue(currentUser);
    BookClub.getById.mockResolvedValue({ clubId: 'c1', name: 'Fiction Club', createdBy: 'user-1', inviteCode: 'ABC12345' });
    BookClub.getMemberRecord.mockResolvedValue({ clubId: 'c1', userId: 'user-1', role: 'admin', status: 'active' });
    
    const mockInvites = [
      { clubId: 'c1', email: 'test@example.com', invitedBy: 'user-1', status: 'pending' }
    ];
    BookClub.addEmailInvites.mockResolvedValue(mockInvites);
    User.getById.mockResolvedValue(currentUser);
    sendClubInvite.mockResolvedValue({ sent: true });

    const event = {
      pathParameters: { clubId: 'c1' },
      headers: authHeader,
      body: JSON.stringify({ emails: ['test@example.com', 'invalid-email'] })
    };

    const res = await handler(event);

    expect(User.getCurrentUser).toHaveBeenCalledWith('token123');
    expect(BookClub.getById).toHaveBeenCalledWith('c1');
    expect(BookClub.getMemberRecord).toHaveBeenCalledWith('c1', 'user-1');
    expect(BookClub.addEmailInvites).toHaveBeenCalledWith('c1', ['test@example.com'], 'user-1');
    expect(User.getById).toHaveBeenCalledWith('user-1');
    expect(sendClubInvite).toHaveBeenCalledWith({
      to: 'test@example.com',
      inviterName: 'Alice',
      clubName: 'Fiction Club',
      inviteCode: 'ABC12345'
    });
    
    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(body.data.invited).toBe(1);
    expect(body.data.invalid).toEqual(['invalid-email']);
  });

  it('returns 400 when no valid emails provided', async () => {
    User.getCurrentUser.mockResolvedValue(currentUser);
    BookClub.getById.mockResolvedValue({ clubId: 'c1', name: 'Fiction Club', createdBy: 'user-1', inviteCode: 'ABC12345' });
    BookClub.getMemberRecord.mockResolvedValue({ clubId: 'c1', userId: 'user-1', role: 'admin', status: 'active' });

    const event = {
      pathParameters: { clubId: 'c1' },
      headers: authHeader,
      body: JSON.stringify({ emails: ['invalid-email'] })
    };

    const res = await handler(event);
    expect(res.statusCode).toBe(400);
  });

  it('returns 403 if sender is not active admin or creator', async () => {
    User.getCurrentUser.mockResolvedValue(currentUser);
    BookClub.getById.mockResolvedValue({ clubId: 'c1', name: 'Fiction Club', createdBy: 'user-2', inviteCode: 'ABC12345' });
    BookClub.getMemberRecord.mockResolvedValue({ clubId: 'c1', userId: 'user-1', role: 'member', status: 'active' });

    const event = {
      pathParameters: { clubId: 'c1' },
      headers: authHeader,
      body: JSON.stringify({ emails: ['test@example.com'] })
    };

    const res = await handler(event);
    expect(res.statusCode).toBe(403);
  });
});
