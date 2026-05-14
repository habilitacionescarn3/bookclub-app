const Comment = require('../../models/comment');
const User = require('../../models/user');

const buildUserNamesMap = async (userIds) => {
  const entries = await Promise.all(
    [...new Set(userIds)].map(async (userId) => {
      try {
        const user = await User.getById(userId);
        return [userId, user ? user.name : null];
      } catch (_) {
        return [userId, null];
      }
    })
  );

  return Object.fromEntries(entries);
};

const enrichPosts = async (posts, viewerUserId) => {
  if (!Array.isArray(posts) || posts.length === 0) {
    return [];
  }

  const commentsByPostId = await Comment.listByPostIds(posts.map(post => post.postId));
  const userIds = [
    ...posts.map(post => post.authorId),
    ...posts.flatMap(post => (commentsByPostId[post.postId] || []).map(comment => comment.userId)),
  ];
  const userNames = await buildUserNamesMap(userIds);

  return posts.map((post) => {
    const comments = (commentsByPostId[post.postId] || []).map(comment => ({
      ...comment,
      userName: userNames[comment.userId] || null,
      isOwner: comment.userId === viewerUserId,
    }));

    return {
      ...post,
      authorName: userNames[post.authorId] || null,
      isOwner: post.authorId === viewerUserId,
      comments,
      commentCount: comments.length,
    };
  });
};

module.exports = {
  enrichPosts,
};
