const User = require('../../models/user');
const response = require('../../lib/response');
const { withAuth } = require('../../lib/middleware');

const handler = async (event) => {
  try {
    const { userId } = event;
    const data = JSON.parse(event.body);

    // Validate input - only allow certain fields to be updated
    const allowedUpdates = ['name', 'bio', 'profilePicture', 'timezone'];
    const updates = {};

    Object.keys(data).forEach(key => {
      if (allowedUpdates.includes(key) && data[key] !== undefined) {
        updates[key] = data[key];
      }
    });

    if (Object.keys(updates).length === 0) {
      return response.validationError({
        message: 'No valid fields to update',
      });
    }

    // Validate timezone if provided
    if (updates.timezone) {
      const validTimezones = Intl.supportedValuesOf('timeZone');
      // Accept "UTC" as a special case since it's used by the frontend but not in Intl.supportedValuesOf
      if (updates.timezone !== 'UTC' && !validTimezones.includes(updates.timezone)) {
        return response.validationError({
          timezone: 'Invalid timezone',
        });
      }
    }

    const updatedUser = await User.update(userId, updates);
    
    if (!updatedUser) {
      return response.notFound('User not found');
    }

    // Return only necessary user data
    const userData = {
      userId: updatedUser.userId,
      email: updatedUser.email,
      name: updatedUser.name,
      bio: updatedUser.bio,
      profilePicture: updatedUser.profilePicture,
      timezone: updatedUser.timezone,
      createdAt: updatedUser.createdAt,
    };

    return response.success(userData);
  } catch (error) {
    console.error('Error updating profile:', error);
    return response.error(error);
  }
};

module.exports.handler = withAuth(handler);