import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, addDoc, serverTimestamp, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import './BattalionNetwork.css';

export default function BattalionNetwork({ profile }) {
  const [activeTab, setActiveTab] = useState('feed');
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [newPost, setNewPost] = useState({ content: '', type: 'Update' });
  const [directory, setDirectory] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [battalionProfile, setBattalionProfile] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    dream: '',
    reasonToJoin: '',
    valuableAsset: '',
    expectations: '',
    siblingInfo: '',
    armedForce: ''
  });
  
  // Phase 3 State
  const [events, setEvents] = useState([]);
  const [newEvent, setNewEvent] = useState({ title: '', date: '', location: '', description: '' });
  const [feedback, setFeedback] = useState({ rating: '5', comments: '' });

  useEffect(() => {
    if (activeTab === 'feed') {
      fetchPosts();
    } else if (activeTab === 'directory') {
      fetchDirectory();
    } else if (activeTab === 'events') {
      fetchEvents();
    } else if (activeTab === 'chat' && activeChat) {
      const q = query(
        collection(db, 'battalion_chats'), 
        where('participants', 'array-contains', profile.uid || profile.id)
      );
      const msgsRef = collection(db, 'battalion_chats', activeChat.chatId, 'messages');
      const msgQ = query(msgsRef, orderBy('timestamp', 'asc'), limit(50));
      const unsub = onSnapshot(msgQ, (snap) => {
        setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => unsub();
    }

    const unsubProfile = onSnapshot(doc(db, 'battalion_profiles', profile.uid || profile.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBattalionProfile({ id: docSnap.id, ...data });
        if (data.isProfileComplete) {
          setProfileForm({
            dream: data.dream || '',
            reasonToJoin: data.reasonToJoin || '',
            valuableAsset: data.valuableAsset || '',
            expectations: data.expectations || '',
            siblingInfo: data.siblingInfo || '',
            armedForce: data.armedForce || ''
          });
        }
      }
    });
    return () => unsubProfile();
  }, [activeTab, activeChat, profile]);

  const fetchPosts = async () => {
    setLoadingPosts(true);
    try {
      // Cost Optimization: Standard getDocs with limit
      const q = query(collection(db, 'battalion_posts'), orderBy('timestamp', 'desc'), limit(15));
      const snap = await getDocs(q);
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    }
    setLoadingPosts(false);
  };

  const fetchDirectory = async () => {
    try {
      const q = query(collection(db, 'battalion_profiles'), limit(50));
      const snap = await getDocs(q);
      setDirectory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEvents = async () => {
    try {
      const q = query(collection(db, 'battalion_events'), orderBy('timestamp', 'desc'), limit(20));
      const snap = await getDocs(q);
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    }
  };

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!newPost.content.trim()) return;
    try {
      await addDoc(collection(db, 'battalion_posts'), {
        authorId: profile.uid || profile.id,
        authorName: profile.fullName || 'Shishya',
        batchYear: profile.batch || 'Unknown',
        content: newPost.content,
        type: newPost.type,
        timestamp: serverTimestamp()
      });
      setNewPost({ content: '', type: 'Update' });
      fetchPosts(); // Refetch
    } catch (err) {
      console.error(err);
      alert('Failed to post');
    }
  };

  const openChat = async (targetUser) => {
    const myId = profile.uid || profile.id;
    const targetId = targetUser.id;
    const chatId = [myId, targetId].sort().join('_');
    
    // Ensure chat doc exists
    await setDoc(doc(db, 'battalion_chats', chatId), {
      participants: [myId, targetId],
      updatedAt: serverTimestamp()
    }, { merge: true });

    setActiveChat({ ...targetUser, chatId });
    setActiveTab('chat');
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;
    
    try {
      await addDoc(collection(db, 'battalion_chats', activeChat.chatId, 'messages'), {
        senderId: profile.uid || profile.id,
        senderName: profile.fullName || 'Shishya',
        text: newMessage,
        timestamp: serverTimestamp()
      });
      setNewMessage('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'battalion_profiles', profile.uid || profile.id), {
        ...profileForm,
        isProfileComplete: true,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setIsEditingProfile(false);
      alert('Battalion Profile Updated Successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to update profile.');
    }
  };

  const handleEventSubmit = async (e) => {
    e.preventDefault();
    if (!newEvent.title.trim()) return;
    try {
      await addDoc(collection(db, 'battalion_events'), {
        ...newEvent,
        organizerId: profile.uid || profile.id,
        organizerName: profile.fullName || 'Shishya',
        timestamp: serverTimestamp()
      });
      setNewEvent({ title: '', date: '', location: '', description: '' });
      fetchEvents();
      alert('Gathering Organized Successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to post event.');
    }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'battalion_feedback'), {
        ...feedback,
        shishyaId: profile.uid || profile.id,
        shishyaName: profile.fullName || 'Shishya',
        batchYear: profile.batch || 'Unknown',
        timestamp: serverTimestamp()
      });
      setFeedback({ rating: '5', comments: '' });
      alert('Feedback Submitted! Thank you for keeping us improving.');
      setActiveTab('feed');
    } catch (err) {
      console.error(err);
      alert('Failed to submit feedback.');
    }
  };

  return (
    <div className="battalion-container">
      <div className="battalion-hero">
        <h1>Battalion Network</h1>
        <p>Roots Deep, Wings Wide, Hearts United</p>
      </div>

      <div className="battalion-tabs">
        <button className={activeTab === 'feed' ? 'active' : ''} onClick={() => setActiveTab('feed')}>
          <span className="material-symbols-outlined">dynamic_feed</span> Network Feed
        </button>
        <button className={activeTab === 'events' ? 'active' : ''} onClick={() => setActiveTab('events')}>
          <span className="material-symbols-outlined">event</span> Gatherings
        </button>
        <button className={activeTab === 'directory' ? 'active' : ''} onClick={() => setActiveTab('directory')}>
          <span className="material-symbols-outlined">groups</span> Alumni Directory
        </button>
        <button className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')}>
          <span className="material-symbols-outlined">person</span> My Profile
        </button>
        <button className={activeTab === 'feedback' ? 'active' : ''} onClick={() => setActiveTab('feedback')}>
          <span className="material-symbols-outlined">rate_review</span> RM Feedback
        </button>
      </div>

      <div className="battalion-content">
        {activeTab === 'feed' && (
          <div className="feed-layout">
            <div className="create-post-card">
              <form onSubmit={handlePostSubmit}>
                <textarea 
                  placeholder="Share an update, opportunity, or ask for guidance..."
                  value={newPost.content}
                  onChange={(e) => setNewPost({...newPost, content: e.target.value})}
                  rows={3}
                ></textarea>
                <div className="post-actions">
                  <select 
                    value={newPost.type} 
                    onChange={e => setNewPost({...newPost, type: e.target.value})}
                  >
                    <option value="Update">General Update</option>
                    <option value="Guidance">Need Guidance</option>
                    <option value="Referral">Job/College Referral</option>
                  </select>
                  <button type="submit" className="btn btn-brand">Post</button>
                </div>
              </form>
            </div>

            <div className="posts-list">
              {loadingPosts ? <div className="spinner"></div> : posts.map(post => (
                <div key={post.id} className="post-card">
                  <div className="post-header">
                    <div className="post-avatar">
                      <span className="material-symbols-outlined">person</span>
                    </div>
                    <div className="post-meta">
                      <strong>{post.authorName}</strong>
                      <span>Batch: {post.batchYear} • {post.type}</span>
                    </div>
                  </div>
                  <div className="post-body">
                    {post.content}
                  </div>
                </div>
              ))}
              {!loadingPosts && posts.length === 0 && (
                <div className="empty-state">No posts yet. Be the first to share!</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'directory' && (
          <div className="directory-grid">
            {directory.map(user => (
              <div key={user.id} className="directory-card">
                <div className="dir-avatar">
                  <span className="material-symbols-outlined">person</span>
                </div>
                <h3>{user.fullName}</h3>
                <p>Batch: {user.batchYear}</p>
                <p className="status">{user.currentStatus}</p>
                <button className="btn btn-outline" onClick={() => openChat(user)}>
                  Connect & Chat
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'chat' && activeChat && (
          <div className="chat-interface">
            <div className="chat-header">
              <button className="btn btn-ghost" onClick={() => setActiveTab('directory')}>
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div className="chat-title">
                <strong>{activeChat.fullName}</strong>
                <span>{activeChat.batchYear} • {activeChat.currentStatus}</span>
              </div>
            </div>
            
            <div className="chat-messages">
              {messages.map(msg => {
                const isMe = msg.senderId === (profile.uid || profile.id);
                return (
                  <div key={msg.id} className={`message-bubble ${isMe ? 'mine' : 'theirs'}`}>
                    <div className="msg-author">{!isMe && msg.senderName}</div>
                    <div className="msg-text">{msg.text}</div>
                  </div>
                );
              })}
              {messages.length === 0 && (
                <div className="empty-state">Send a message to start the conversation!</div>
              )}
            </div>

            <form className="chat-input" onSubmit={handleSendMessage}>
              <input 
                type="text" 
                placeholder="Type your message..." 
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
              />
              <button type="submit" className="btn btn-brand">Send</button>
            </form>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="profile-tab-content">
            {battalionProfile?.isProfileComplete && !isEditingProfile ? (
              <div className="completed-profile-view">
                <h2>Your Battalion Dossier</h2>
                <button className="btn btn-outline edit-btn" onClick={() => setIsEditingProfile(true)}>
                  Edit Profile
                </button>
                <div className="dossier-grid">
                  <div className="dossier-item">
                    <h4>Dream / Purpose in Life</h4>
                    <p>{battalionProfile.dream}</p>
                  </div>
                  <div className="dossier-item">
                    <h4>Reason to Join Battalion</h4>
                    <p>{battalionProfile.reasonToJoin}</p>
                  </div>
                  <div className="dossier-item">
                    <h4>How you add value</h4>
                    <p>{battalionProfile.valuableAsset}</p>
                  </div>
                  <div className="dossier-item">
                    <h4>Expectations</h4>
                    <p>{battalionProfile.expectations}</p>
                  </div>
                  <div className="dossier-item">
                    <h4>Armed / Police Force Interest</h4>
                    <p>{battalionProfile.armedForce}</p>
                  </div>
                  <div className="dossier-item">
                    <h4>Sibling Info</h4>
                    <p>{battalionProfile.siblingInfo}</p>
                  </div>
                </div>
              </div>
            ) : (
              <form className="deep-profile-form" onSubmit={handleProfileUpdate}>
                <h2>Complete Your Battalion Profile</h2>
                <p>These questions help us understand your core values, dreams, and how we can support each other.</p>
                
                <div className="form-group">
                  <label>What is your Dream / Purpose in Life?</label>
                  <textarea required rows={3} value={profileForm.dream} onChange={e => setProfileForm({...profileForm, dream: e.target.value})} />
                </div>

                <div className="form-group">
                  <label>What is your Reason to Join the Battalion?</label>
                  <textarea required rows={3} value={profileForm.reasonToJoin} onChange={e => setProfileForm({...profileForm, reasonToJoin: e.target.value})} />
                </div>

                <div className="form-group">
                  <label>How will you become a valuable asset in the Battalion?</label>
                  <textarea required rows={3} value={profileForm.valuableAsset} onChange={e => setProfileForm({...profileForm, valuableAsset: e.target.value})} />
                </div>

                <div className="form-group">
                  <label>What are your expectations from Shishyakul?</label>
                  <textarea required rows={3} value={profileForm.expectations} onChange={e => setProfileForm({...profileForm, expectations: e.target.value})} />
                </div>

                <div className="form-group">
                  <label>Are you aspiring for Armed/Police Forces? (Details)</label>
                  <input type="text" value={profileForm.armedForce} onChange={e => setProfileForm({...profileForm, armedForce: e.target.value})} />
                </div>

                <div className="form-group">
                  <label>Sibling Information (Name, Age, Studying/Working)</label>
                  <textarea rows={2} value={profileForm.siblingInfo} onChange={e => setProfileForm({...profileForm, siblingInfo: e.target.value})} />
                </div>

                <div className="form-actions">
                  {battalionProfile?.isProfileComplete && (
                    <button type="button" className="btn btn-ghost" onClick={() => setIsEditingProfile(false)}>Cancel</button>
                  )}
                  <button type="submit" className="btn btn-brand">Save Dossier</button>
                </div>
              </form>
            )}
          </div>
        )}

        {activeTab === 'events' && (
          <div className="feed-layout">
            <div className="create-post-card">
              <h3>Organize a Gathering / Reunion</h3>
              <form onSubmit={handleEventSubmit}>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <input type="text" placeholder="Event Title (e.g., 2023 Batch Meetup)" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} required />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                  <input type="date" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} required style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--surface-border)' }} />
                  <input type="text" placeholder="Location" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} required style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--surface-border)' }} />
                </div>
                <textarea 
                  placeholder="Event Details & RSVP Info..."
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                  rows={3}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--surface-border)', marginBottom: '12px', boxSizing: 'border-box' }}
                  required
                ></textarea>
                <div className="post-actions">
                  <button type="submit" className="btn btn-brand">Post Event</button>
                </div>
              </form>
            </div>

            <div className="posts-list">
              {events.map(ev => (
                <div key={ev.id} className="post-card">
                  <div className="post-header">
                    <div className="post-avatar">
                      <span className="material-symbols-outlined">event</span>
                    </div>
                    <div className="post-meta">
                      <strong>{ev.title}</strong>
                      <span>Organized by {ev.organizerName}</span>
                    </div>
                  </div>
                  <div className="post-body">
                    <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--brand-primary)', fontWeight: '600' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', verticalAlign: 'middle' }}>calendar_month</span> {ev.date} &nbsp;|&nbsp; 
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', verticalAlign: 'middle' }}>location_on</span> {ev.location}
                    </p>
                    {ev.description}
                  </div>
                </div>
              ))}
              {events.length === 0 && (
                <div className="empty-state">No upcoming gatherings. Take the initiative!</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'feedback' && (
          <div className="profile-tab-content">
            <form className="deep-profile-form" onSubmit={handleFeedbackSubmit}>
              <h2>Relationship Manager Feedback</h2>
              <p>Feedbacks keep us improving. Please rate your recent call with your RM.</p>
              
              <div className="form-group">
                <label>Rate the Support / Call Experience (1 to 5)</label>
                <select value={feedback.rating} onChange={e => setFeedback({...feedback, rating: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'var(--surface-bg)', color: 'var(--text-primary)' }}>
                  <option value="5">⭐⭐⭐⭐⭐ - Excellent</option>
                  <option value="4">⭐⭐⭐⭐ - Good</option>
                  <option value="3">⭐⭐⭐ - Average</option>
                  <option value="2">⭐⭐ - Poor</option>
                  <option value="1">⭐ - Very Poor</option>
                </select>
              </div>

              <div className="form-group">
                <label>How can we improve our support for the Battalion?</label>
                <textarea required rows={4} value={feedback.comments} onChange={e => setFeedback({...feedback, comments: e.target.value})} />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-brand">Submit Feedback</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
