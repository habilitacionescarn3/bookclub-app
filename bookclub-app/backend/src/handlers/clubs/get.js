const BookClub = require('../../models/bookclub');
const User = require('../../models/user');
const { success, error } = require('../../lib/response');

exports.handler = async (event) => {
  try {
    const { clubId } = event.pathParameters;

    if (!clubId) {
      return error('Club ID is required', 400);
    }

    // Auth: prefer authorizer claims, fallback to token validation (OPTIONAL for public access)
    const claims = event?.requestContext?.authorizer?.claims;
    let userId = claims?.sub;
    
    console.log(`DEBUG [getClub]: Starting auth check. userId from claims: ${userId}`);
    
    if (!userId) {
      const authHeader = (event.headers && (event.headers.Authorization || event.headers.authorization)) || '';
      const accessTokenHeader = (event.headers && (event.headers['X-Access-Token'] || event.headers['x-access-token'])) || '';
      
      console.log(`DEBUG [getClub]: Headers present - Authorization: ${!!authHeader}, X-Access-Token: ${!!accessTokenHeader}`);
      
      // CRITICAL: We MUST use the Access Token for User.getCurrentUser (Cognito API)
      // ID Tokens will cause an error.
      const token = accessTokenHeader || (authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : authHeader || null);
      
      if (token && token !== 'null') {
        try {
          console.log('DEBUG [getClub]: Attempting to fetch user with token...');
          const currentUser = await User.getCurrentUser(token);
          if (currentUser) {
            userId = currentUser.userId;
            console.log(`DEBUG [getClub]: Identity resolved from token. userId: ${userId}`);
          }
        } catch (err) {
          console.warn(`DEBUG [getClub]: Identity resolution failed: ${err.message}`);
        }
      } else {
        console.log('DEBUG [getClub]: No valid token found in headers.');
      }
    }

    // Check if club exists
    const club = await BookClub.getById(clubId);
    if (!club) {
      return error('Club not found', 404);
    }

    // Membership check: only enforced if the club is "Private" (if such a concept exists)
    // For now, we allow public viewing of all clubs, but certain actions/roles require membership
    let isMember = false;
    let userRole = null;
    let userStatus = null;

    if (userId) {
      const memberRecord = await BookClub.getMemberRecord(clubId, userId);
      if (memberRecord) {
        userStatus = memberRecord.status || null;
        isMember = userStatus === 'active';
        userRole = memberRecord.role || null;
      }
    }

    // Return club with user's membership info
    const response = success(result);
    
    // Manual CORS headers to bypass API Gateway config issues
    response.headers = {
      ...response.headers,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Access-Token, x-access-token',
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    return response;
  } catch (err) {
    console.error('Error getting club:', err);
    return error(err.message || 'Failed to get club', 500);
  }
};