import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChatBubbleLeftRightIcon, ChevronDownIcon, ChevronUpIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { apiService } from '../services/api';
import { BookClub, ClubComment, ClubPost } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import SEO from '../components/SEO';

const MAX_POST_LENGTH = 1000;
const MAX_COMMENT_LENGTH = 500;

const formatRelativeTime = (isoDate?: string) => {
  if (!isoDate) return '';

  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return '';

  const diffSeconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSeconds < 60) return 'Just now';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(isoDate));
};

const getInitial = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
};

const avatarClasses = 'h-10 w-10 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-sm font-black flex-shrink-0';
const commentAvatarClasses = 'h-8 w-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-xs font-black flex-shrink-0';

const getCommentTotal = (post: ClubPost) => post.commentCount ?? post.comments?.length ?? 0;

const Discussions: React.FC = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [clubs, setClubs] = useState<BookClub[]>([]);
  const [posts, setPosts] = useState<ClubPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [postText, setPostText] = useState('');
  const [error, setError] = useState('');
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(() => new Set());
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentingPostIds, setCommentingPostIds] = useState<Set<string>>(() => new Set());

  const activeClubs = useMemo(
    () => clubs.filter(club => club.userStatus === 'active' || club.isMember === true),
    [clubs]
  );
  const postingClub = activeClubs[0] || null;
  const clubNames = useMemo(
    () => Object.fromEntries(clubs.map(club => [club.clubId, club.name])),
    [clubs]
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [clubResult, postResult] = await Promise.all([
        apiService.getUserClubs(),
        apiService.listPostsFeed(),
      ]);
      setClubs(clubResult.items || []);
      setPosts(postResult.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load discussions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submitPost = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = postText.trim();
    if (!text || posting) return;
    if (!postingClub) {
      addNotification('error', 'Join a club before sharing a post.');
      return;
    }

    try {
      setPosting(true);
      const created = await apiService.createPost({
        clubId: postingClub.clubId,
        text,
        images: [],
      });
      setPostText('');
      setPosts(prev => [{
        ...created,
        authorName: created.authorName || user?.name || null,
        isOwner: true,
        comments: created.comments || [],
        commentCount: created.commentCount || 0,
      }, ...prev]);
      addNotification('success', 'Post shared');
    } catch (err: any) {
      addNotification('error', err.message || 'Failed to share post');
    } finally {
      setPosting(false);
    }
  };

  const toggleComments = (postId: string) => {
    setExpandedPostIds(prev => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  const updateCommentDraft = (postId: string, value: string) => {
    setCommentDrafts(prev => ({
      ...prev,
      [postId]: value.slice(0, MAX_COMMENT_LENGTH),
    }));
  };

  const submitComment = async (event: React.FormEvent, post: ClubPost) => {
    event.preventDefault();
    const text = (commentDrafts[post.postId] || '').trim();
    if (!text || commentingPostIds.has(post.postId)) return;

    try {
      setCommentingPostIds(prev => {
        const next = new Set(prev);
        next.add(post.postId);
        return next;
      });

      const created = await apiService.createComment(post.postId, {
        text,
        images: [],
      });
      const enrichedComment: ClubComment = {
        ...created,
        userName: created.userName || user?.name || null,
        isOwner: true,
      };

      setPosts(prev => prev.map(existingPost => {
        if (existingPost.postId !== post.postId) return existingPost;
        const existingComments = existingPost.comments || [];
        return {
          ...existingPost,
          comments: [...existingComments, enrichedComment],
          commentCount: (existingPost.commentCount ?? existingComments.length) + 1,
        };
      }));
      setCommentDrafts(prev => {
        const next = { ...prev };
        delete next[post.postId];
        return next;
      });
      setExpandedPostIds(prev => {
        const next = new Set(prev);
        next.add(post.postId);
        return next;
      });
    } catch (err: any) {
      addNotification('error', err.message || 'Failed to add comment');
    } finally {
      setCommentingPostIds(prev => {
        const next = new Set(prev);
        next.delete(post.postId);
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO
        title="Discussions - Club Posts"
        description="Read and share updates with your club."
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-5">
        {error && (
          <div className="mb-5 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-700" />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-3">
            {postingClub ? (
              <form onSubmit={submitPost} className="bg-white border border-gray-200 rounded-lg shadow-sm p-3">
                <div className="flex gap-3">
                  {user?.profilePicture ? (
                    <img src={user.profilePicture} alt="" className="h-10 w-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className={avatarClasses}>{getInitial(user?.name)}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="mb-1.5 min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">{user?.name || 'You'}</p>
                      <p className="truncate text-xs font-semibold text-teal-800">{postingClub.name}</p>
                    </div>
                    <div className="flex items-end gap-2">
                      <textarea
                        value={postText}
                        onChange={event => setPostText(event.target.value.slice(0, MAX_POST_LENGTH))}
                        rows={postText ? 2 : 1}
                        placeholder="Share something with your club..."
                        className="block min-h-[42px] flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-6 text-gray-900 placeholder:text-gray-400 focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-100"
                      />
                      <button
                        type="submit"
                        aria-label={posting ? 'Posting' : 'Post'}
                        disabled={!postText.trim() || posting}
                        className="inline-flex min-h-[42px] flex-shrink-0 items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 sm:px-4"
                      >
                        <PaperAirplaneIcon className="h-4 w-4" />
                        <span className="hidden sm:inline">{posting ? 'Posting...' : 'Post'}</span>
                      </button>
                    </div>
                    {postText && (
                      <div className="mt-1.5 text-right text-xs text-gray-400">
                        {postText.trim().length}/{MAX_POST_LENGTH}
                      </div>
                    )}
                  </div>
                </div>
              </form>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 text-center">
                <ChatBubbleLeftRightIcon className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-3 text-sm font-semibold text-gray-700">Join a club to start a discussion.</p>
              </div>
            )}

            {posts.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-200 rounded-lg p-8 text-center">
                <ChatBubbleLeftRightIcon className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-3 text-sm font-semibold text-gray-700">No posts yet.</p>
                <p className="mt-1 text-sm text-gray-400">Share the first update with your club.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map(post => {
                  const authorName = post.authorName || (post.isOwner ? user?.name : null) || 'Club member';
                  const comments = post.comments || [];
                  const commentTotal = getCommentTotal(post);
                  const commentsExpanded = expandedPostIds.has(post.postId);
                  const commentDraft = commentDrafts[post.postId] || '';
                  const isCommenting = commentingPostIds.has(post.postId);
                  return (
                    <article key={post.postId} className="bg-white border border-gray-200 rounded-lg shadow-sm p-3.5">
                      <div className="flex gap-3">
                        <div className={avatarClasses}>{getInitial(authorName)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <h2 className="text-sm font-bold text-gray-900">{authorName}</h2>
                            <span className="text-xs text-gray-400">-</span>
                            <time className="text-xs font-medium text-gray-400">{formatRelativeTime(post.createdAt)}</time>
                          </div>
                          <p className="mt-0.5 text-xs font-semibold text-teal-800">
                            {clubNames[post.clubId] || 'Club discussion'}
                          </p>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-800">{post.text}</p>
                          {post.images && post.images.length > 0 && (
                            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {post.images.map((image, index) => (
                                <img
                                  key={`${post.postId}-image-${index}`}
                                  src={image}
                                  alt=""
                                  className="aspect-video w-full rounded-lg object-cover border border-gray-100"
                                />
                              ))}
                            </div>
                          )}
                          <div className="mt-3 border-t border-gray-100 pt-2">
                            <button
                              type="button"
                              onClick={() => toggleComments(post.postId)}
                              aria-expanded={commentsExpanded}
                              aria-controls={`comments-${post.postId}`}
                              className="inline-flex min-h-[36px] w-full items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-xs font-bold text-gray-500 transition-colors hover:bg-gray-50 hover:text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-100"
                            >
                              <ChatBubbleLeftRightIcon className="h-4 w-4" />
                              <span>
                                {commentsExpanded ? 'Hide comments' : `${commentTotal} ${commentTotal === 1 ? 'comment' : 'comments'}`}
                              </span>
                              {commentsExpanded ? (
                                <ChevronUpIcon className="h-4 w-4" />
                              ) : (
                                <ChevronDownIcon className="h-4 w-4" />
                              )}
                            </button>

                            {commentsExpanded && (
                              <div id={`comments-${post.postId}`} className="mt-3 space-y-3 border-l-2 border-gray-100 pl-3">
                                {comments.length > 0 ? (
                                  <div className="space-y-3">
                                    {comments.map(comment => {
                                      const commentAuthor = comment.userName || (comment.isOwner ? user?.name : null) || 'Club member';
                                      return (
                                        <div key={comment.commentId} className="flex gap-2.5">
                                          <div className={commentAvatarClasses}>{getInitial(commentAuthor)}</div>
                                          <div className="min-w-0 flex-1">
                                            <div className="inline-block max-w-full rounded-lg bg-gray-50 px-3 py-2">
                                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                <span className="text-xs font-bold text-gray-900">{commentAuthor}</span>
                                                <time className="text-[11px] font-medium text-gray-400">{formatRelativeTime(comment.createdAt)}</time>
                                              </div>
                                              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-gray-700">{comment.text}</p>
                                              {comment.images && comment.images.length > 0 && (
                                                <div className="mt-2 grid grid-cols-2 gap-2">
                                                  {comment.images.map((image, index) => (
                                                    <img
                                                      key={`${comment.commentId}-image-${index}`}
                                                      src={image}
                                                      alt=""
                                                      className="aspect-video w-full rounded-md object-cover border border-gray-100"
                                                    />
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="py-2 text-sm font-medium text-gray-500">
                                    No comments yet.
                                  </div>
                                )}

                                <form onSubmit={event => submitComment(event, post)} className="flex gap-2.5 pt-1">
                                  {user?.profilePicture ? (
                                    <img src={user.profilePicture} alt="" className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
                                  ) : (
                                    <div className={commentAvatarClasses}>{getInitial(user?.name)}</div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <textarea
                                      value={commentDraft}
                                      onChange={event => updateCommentDraft(post.postId, event.target.value)}
                                      rows={2}
                                      placeholder="Write a comment..."
                                      className="block w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                                    />
                                    <div className="mt-2 flex items-center justify-between gap-3">
                                      <span className="text-[11px] font-medium text-gray-400">
                                        {commentDraft ? `${commentDraft.trim().length}/${MAX_COMMENT_LENGTH}` : ''}
                                      </span>
                                      <button
                                        type="submit"
                                        aria-label={isCommenting ? 'Posting comment' : 'Comment'}
                                        disabled={!commentDraft.trim() || isCommenting}
                                        className="inline-flex min-h-[34px] items-center gap-2 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                                      >
                                        <PaperAirplaneIcon className="h-3.5 w-3.5" />
                                        <span className="hidden sm:inline">{isCommenting ? 'Posting...' : 'Comment'}</span>
                                      </button>
                                    </div>
                                  </div>
                                </form>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Discussions;
