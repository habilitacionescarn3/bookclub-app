jest.mock('../../../src/lib/aws-config', () => {
  const sendEmailMock = { promise: jest.fn().mockResolvedValue({ MessageId: 'test' }) };
  const SESInstance = { sendEmail: jest.fn(() => sendEmailMock) };
  const SES = jest.fn().mockImplementation(() => SESInstance);
  // Provide DynamoDB.DocumentClient to satisfy dynamodb.js module init
  const DynamoDB = { DocumentClient: jest.fn().mockImplementation(() => ({
    get: jest.fn(), put: jest.fn(), update: jest.fn(), delete: jest.fn(), query: jest.fn(), scan: jest.fn(),
  })) };
  return { SES, DynamoDB, _sesInstance: SESInstance, _sendEmailMock: sendEmailMock };
});

jest.mock('../../../src/lib/dynamodb', () => ({
  get: jest.fn(),
  update: jest.fn().mockResolvedValue({}),
  generateUpdateExpression: jest.fn(() => ({
    UpdateExpression: 'SET #u = :u',
    ExpressionAttributeNames: { '#u': 'updatedAt' },
    ExpressionAttributeValues: { ':u': new Date().toISOString() },
  })),
}));

const dynamoDb = require('../../../src/lib/dynamodb');
const { getUserPrefs, setUserPrefs, sendEmailIfEnabled, DEFAULT_PREFS } = require('../../../src/lib/notification-service');

describe('notification-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns defaults when user not found', async () => {
    dynamoDb.get.mockResolvedValueOnce(null);
    const res = await getUserPrefs('u1');
    expect(res.emailOptIn).toBe(true);
    expect(res.prefs).toEqual(DEFAULT_PREFS);
  });

  it('merges stored prefs over defaults', async () => {
    dynamoDb.get.mockResolvedValueOnce({ userId: 'u1', email: 'u@e.com', name: 'U', notificationPrefs: { dm_message_received: false } });
    const res = await getUserPrefs('u1');
    expect(res.prefs.dm_message_received).toBe(false);
    // unchanged default remains true
    expect(res.prefs.club_announcement).toBe(true);
  });

  it('sendEmailIfEnabled skips when opted out', async () => {
    dynamoDb.get.mockResolvedValueOnce({ userId: 'u1', email: 'u@e.com', name: 'U', emailOptIn: false });
    const out = await sendEmailIfEnabled('u1', 'dm_message_received', 'dm_message_received', { fromName: 'A' });
    expect(out.skipped).toBe('opted_out');
  });

  it('setUserPrefs updates and returns merged prefs', async () => {
    dynamoDb.update.mockResolvedValueOnce({});
    dynamoDb.get.mockResolvedValueOnce({ userId: 'u1', email: 'u@e.com', name: 'U', emailOptIn: true, notificationPrefs: { dm_message_received: false } });
    const res = await setUserPrefs('u1', { prefs: { dm_message_received: false } });
    expect(dynamoDb.update).toHaveBeenCalled();
    expect(res.prefs.dm_message_received).toBe(false);
  });

  describe('sendClubInvite', () => {
    it('renders the template with auto-join wording and sends email', async () => {
      const awsConfig = require('../../../src/lib/aws-config');
      const { sendClubInvite } = require('../../../src/lib/notification-service');

      const mockSendEmail = awsConfig._sesInstance.sendEmail;

      await sendClubInvite({
        to: 'recipient@example.com',
        inviterName: 'Alice',
        clubName: 'Fantasy Book Club',
        inviteCode: '12345XYZ'
      });

      expect(mockSendEmail).toHaveBeenCalled();
      const sendParams = mockSendEmail.mock.calls[0][0];
      
      expect(sendParams.Destination.ToAddresses).toEqual(['recipient@example.com']);
      expect(sendParams.Message.Subject.Data).toBe('You are invited to join the book club "Fantasy Book Club"');
      
      // Verify text and HTML bodies contain the auto-join wording and NOT the code fallback
      const textBody = sendParams.Message.Body.Text.Data;
      const htmlBody = sendParams.Message.Body.Html.Data;

      expect(textBody).toContain('You will be joined automatically once you log in or sign up with this email address.');
      expect(textBody).not.toContain('12345XYZ');
      expect(htmlBody).toContain('You will be joined automatically once you log in or sign up with this email address.');
      expect(htmlBody).not.toContain('12345XYZ');
    });
  });
});

