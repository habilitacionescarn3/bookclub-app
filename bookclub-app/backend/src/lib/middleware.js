const { getAuthenticatedUserId } = require('./get-user-id');
const { error } = require('./response');
const User = require('../models/user');
const BookClub = require('../models/bookclub');

/**
 * Ensures the request is authenticated.
 * Injects event.userId into the handler.
 */
const withAuth = (handler) => async (event, context) => {
  try {
    const userId = await getAuthenticatedUserId(event);
    if (!userId) return error('Unauthorized', 401);
    
    event.userId = userId;
    return handler(event, context);
  } catch (err) {
    return error(err.message || 'Unauthorized', 401);
  }
};

/**
 * Ensures the request is authenticated and fetches the full user record.
 * Injects event.userId and event.currentUser into the handler.
 */
const withUser = (handler) => async (event, context) => {
  try {
    const userId = await getAuthenticatedUserId(event);
    if (!userId) return error('Unauthorized', 401);
    
    const currentUser = await User.getById(userId);
    if (!currentUser) return error('User not found', 404);
    
    event.userId = userId;
    event.currentUser = currentUser;
    return handler(event, context);
  } catch (err) {
    return error(err.message || 'Unauthorized', 401);
  }
};

/**
 * Ensures the user has admin or superadmin privileges.
 */
const withAdmin = (handler) => withUser(async (event, context) => {
  const { currentUser } = event;
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';
  
  if (!isAdmin) return error('Forbidden: Admin access required', 403);
  return handler(event, context);
});

/**
 * Ensures the user is a club admin or superadmin.
 */
const withClubAdmin = (handler) => withUser(async (event, context) => {
  const { userId, currentUser } = event;
  const clubId = event.pathParameters?.clubId;
  
  if (!clubId) return error('Club ID is required', 400);
  
  const isSuperAdmin = currentUser.role === 'superadmin';
  const club = await BookClub.getById(clubId);
  
  if (!club) return error('Club not found', 404);
  
  const isCreator = club.createdBy === userId;
  const memberRole = await BookClub.getMemberRole(clubId, userId);
  const isClubAdmin = memberRole === 'admin';
  
  if (!isSuperAdmin && !isCreator && !isClubAdmin) {
    return error('Forbidden: Club admin access required', 403);
  }
  
  event.club = club; // Optionally inject club object
  return handler(event, context);
});

/**
 * Ensures the user is the club creator or superadmin.
 */
const withClubOwner = (handler) => withUser(async (event, context) => {
  const { userId, currentUser } = event;
  const clubId = event.pathParameters?.clubId;
  
  if (!clubId) return error('Club ID is required', 400);
  
  const isSuperAdmin = currentUser.role === 'superadmin';
  const club = await BookClub.getById(clubId);
  
  if (!club) return error('Club not found', 404);
  
  const isCreator = club.createdBy === userId;
  
  if (!isSuperAdmin && !isCreator) {
    return error('Forbidden: Club owner access required', 403);
  }
  
  event.club = club;
  return handler(event, context);
});

module.exports = {
  withAuth,
  withUser,
  withAdmin,
  withClubAdmin,
  withClubOwner,
};
