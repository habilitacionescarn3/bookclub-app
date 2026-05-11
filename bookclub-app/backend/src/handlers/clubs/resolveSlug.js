const BookClub = require('../../models/bookclub');
const { success, error } = require('../../lib/response');

exports.handler = async (event) => {
  try {
    const { slug } = event.pathParameters;

    if (!slug) {
      return error('Slug is required', 400);
    }

    const club = await BookClub.getBySlug(slug);
    
    if (!club) {
      // Return 200 with null instead of 404 to avoid console noise for invalid subdomains
      return success({ club: null });
    }

    // Return minimal set of public data for branding
    const response = success({ club: result });
    
    // Manual CORS headers
    response.headers = {
      ...response.headers,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Access-Token, x-access-token',
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    return response;
  } catch (err) {
    console.error('Error resolving club slug:', err);
    return error(err.message || 'Failed to resolve club', 500);
  }
};
