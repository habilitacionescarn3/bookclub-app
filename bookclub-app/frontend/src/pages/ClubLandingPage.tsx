import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Book, BookClub } from '../types';
import { apiService } from '../services/api';
import PublicBookCard from '../components/PublicBookCard';
import { useAuth } from '../contexts/AuthContext';
import { ArchiveBoxIcon, UserPlusIcon, UsersIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

const ClubLandingPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  
  const [club, setClub] = useState<BookClub | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const scrollRefs = React.useRef<{ [key: string]: HTMLDivElement | null }>({});

  const init = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError('');
    try {
      // 1. Resolve slug publicly (guaranteed no token sent)
      const resolved = await apiService.resolveClubSlugPublic(slug);
      if (!resolved?.clubId) {
        setError('Club not found');
        return;
      }
      setClub(resolved);

      // 2. Fetch books publicly
      const res = await apiService.listBooksPublic({ 
        clubId: resolved.clubId, 
        limit: 20, 
        bare: true 
      });
      setBooks(res.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load club details');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    init();
  }, [init]);

  const handleRequestJoin = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: window.location.pathname } });
      return;
    }
    if (!club?.clubId) return;
    try {
      setJoining(true);
      setJoinError('');
      await apiService.requestClubJoin(club.clubId);
      setClub(prev => prev ? { ...prev, userStatus: 'pending' } : prev);
    } catch (e: any) {
      setJoinError(e.message || 'Failed to send join request');
    } finally {
      setJoining(false);
    }
  };

  // Helper to group books by category
  const groupedItems = books.reduce((acc, book) => {
    const category = book.category || 'book';
    if (!acc[category]) acc[category] = [];
    acc[category].push(book);
    return acc;
  }, {} as Record<string, Book[]>);

  const categoryLabels: Record<string, string> = {
    book: '📚 Books',
    toy: '🧸 Toys',
    tool: '🛠️ Tools',
    game: '🎲 Games',
    event_hire: '🎉 Event Hire',
    other: '✨ Other Items'
  };

  const scrollLeft = (category: string) => {
    const element = scrollRefs.current[category];
    if (element) element.scrollBy({ left: -320, behavior: 'smooth' });
  };

  const scrollRight = (category: string) => {
    const element = scrollRefs.current[category];
    if (element) element.scrollBy({ left: 320, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading club details…</p>
        </div>
      </div>
    );
  }

  if (error || !club) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-gray-100">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <ArchiveBoxIcon className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2 uppercase italic tracking-tight">Oops!</h1>
          <p className="text-gray-500 mb-8 font-medium leading-relaxed">{error || 'This club could not be found.'}</p>
          <Link to="/clubs/browse" className="inline-flex items-center justify-center px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-tight hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95">
            Browse other clubs
          </Link>
        </div>
      </div>
    );
  }

  const isMember = club.userStatus === 'active' || club.isMember;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 mb-8">
          <Link to="/clubs/browse" className="hover:text-indigo-600 transition-colors">Browse Clubs</Link>
          <span>/</span>
          <span className="text-gray-900">Explore Club</span>
        </nav>

        {/* Premium Hero Section */}
        <div className="bg-white rounded-[40px] shadow-2xl shadow-gray-200/50 overflow-hidden border border-gray-100 mb-16">
          <div className="md:flex">
            <div className="p-8 md:p-16 md:flex-1">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-xs font-black uppercase tracking-widest mb-8 border border-indigo-100">
                <UsersIcon className="w-4 h-4" />
                Community Club
              </div>
              
              <h1 className="text-5xl md:text-7xl font-black text-gray-900 tracking-tight leading-[0.9] uppercase italic mb-8">
                {club.name}
              </h1>
              
              <p className="text-xl text-gray-600 leading-relaxed max-w-xl mb-12 font-medium">
                {club.description || 'Welcome to our community library. We share books, toys, tools and more to build a more sustainable neighbourhood.'}
              </p>

              <div className="flex flex-wrap gap-4">
                {isMember ? (
                  <button
                    onClick={() => navigate(`/clubs/${club.clubId}`)}
                    className="inline-flex items-center justify-center gap-3 px-10 py-5 bg-indigo-600 text-white rounded-[24px] font-black uppercase tracking-tight hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 active:scale-95"
                  >
                    <ShieldCheckIcon className="w-6 h-6" />
                    Enter Member Dashboard
                  </button>
                ) : club.userStatus === 'pending' ? (
                  <div className="inline-flex items-center gap-3 px-10 py-5 bg-amber-50 text-amber-700 border-2 border-amber-200 rounded-[24px] font-black uppercase tracking-tight italic">
                    <div className="animate-pulse w-2 h-2 rounded-full bg-amber-500" />
                    Request Pending
                  </div>
                ) : (
                  <button
                    onClick={handleRequestJoin}
                    disabled={joining}
                    className="inline-flex items-center justify-center gap-3 px-10 py-5 bg-indigo-600 text-white rounded-[24px] font-black uppercase tracking-tight hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 active:scale-95"
                  >
                    <UserPlusIcon className="w-6 h-6" />
                    {joining ? 'Sending...' : 'Request to Join Club'}
                  </button>
                )}
                
                {!isAuthenticated && !isMember && (
                  <button
                    onClick={() => navigate('/login', { state: { from: window.location.pathname } })}
                    className="inline-flex items-center justify-center gap-3 px-10 py-5 bg-white text-gray-900 border-2 border-gray-100 rounded-[24px] font-black uppercase tracking-tight hover:bg-gray-50 transition-all active:scale-95"
                  >
                    Sign in
                  </button>
                )}
              </div>
              
              {joinError && <p className="mt-4 text-sm font-bold text-red-500 uppercase tracking-tight italic">{joinError}</p>}
            </div>
            
            <div className="bg-gray-50 md:w-1/3 border-l border-gray-100 p-8 md:p-16 flex flex-col justify-center">
              <div className="space-y-8">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Inventory Size</p>
                  <p className="text-4xl font-black text-gray-900 italic">{books.length}+ Items</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Member Status</p>
                  <p className="text-xl font-bold text-gray-600">
                    {isMember ? '✅ You are a member' : '🔐 Members Only Access'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sample Library Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black text-gray-900 uppercase italic tracking-tight">Shared Library Preview</h2>
            {!isMember && (
              <p className="text-sm font-bold text-indigo-600 uppercase tracking-widest hidden sm:block">Join to borrow items</p>
            )}
          </div>

          {books.length === 0 ? (
            <div className="bg-white rounded-[32px] border-2 border-dashed border-gray-200 p-20 text-center">
              <ArchiveBoxIcon className="w-16 h-16 text-gray-200 mx-auto mb-6" />
              <p className="text-xl font-bold text-gray-400 italic uppercase">The shelves are currently quiet</p>
              <p className="text-gray-400 mt-2">New items are added by members every week.</p>
            </div>
          ) : (
            <div className="space-y-16">
              {Object.entries(groupedItems).map(([category, items]) => (
                <section key={category} className="relative">
                  <div className="flex items-center gap-4 mb-6">
                    <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tight">
                      {categoryLabels[category] || category}
                    </h3>
                    <div className="h-px bg-gray-100 flex-1" />
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
                      {items.length} Available
                    </span>
                  </div>

                  <div className="relative group">
                    <div
                      ref={(el) => { if (el) scrollRefs.current[category] = el; }}
                      className="flex overflow-x-auto pb-8 gap-6 scrollbar-hide snap-x"
                    >
                      {items.map((item) => (
                        <div key={item.bookId} className="w-[280px] shrink-0 snap-start">
                          <PublicBookCard book={item} isMemberOfBookClub={isMember} />
                        </div>
                      ))}
                    </div>

                    {items.length > 3 && (
                      <>
                        <button
                          onClick={() => scrollLeft(category)}
                          className="absolute -left-5 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white rounded-full shadow-2xl flex items-center justify-center text-gray-900 hover:scale-110 transition-all opacity-0 group-hover:opacity-100 active:scale-95 border border-gray-100"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => scrollRight(category)}
                          className="absolute -right-5 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white rounded-full shadow-2xl flex items-center justify-center text-gray-900 hover:scale-110 transition-all opacity-0 group-hover:opacity-100 active:scale-95 border border-gray-100"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
        
        {/* Bottom CTA */}
        {!isMember && (
          <div className="bg-indigo-900 rounded-[40px] p-12 md:p-20 text-center text-white overflow-hidden relative shadow-2xl shadow-indigo-200">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-800 rounded-full -mr-48 -mt-48 blur-3xl opacity-50" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-800 rounded-full -ml-48 -mb-48 blur-3xl opacity-50" />
            
            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tight mb-6">Ready to start borrowing?</h2>
              <p className="text-indigo-200 text-lg font-medium mb-10 leading-relaxed">
                Join {club.name} today to access the full library, connect with neighbours, and start sharing.
              </p>
              <button
                onClick={handleRequestJoin}
                className="px-12 py-5 bg-white text-indigo-900 rounded-[24px] font-black uppercase tracking-tight hover:bg-indigo-50 transition-all shadow-2xl active:scale-95"
              >
                Request to Join
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClubLandingPage;
