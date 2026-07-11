import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Creates a new notification in the database
 * @param {string} targetUserId - User ID of the recipient
 * @param {string} notifType - Type of notification ('ticket_reply', 'leave_status', 'target', etc.)
 * @param {object} payload - Additional data for the notification
 */
export const createNotification = async (targetUserId, notifType, payload) => {
  try {
    const notifData = {
      targetUserId,
      notifType,
      ...payload,
      read: false,
      createdAt: serverTimestamp()
    };
    await addDoc(collection(db, 'notifications'), notifData);
  } catch (error) {
    console.error("Error creating notification: ", error);
  }
};

/**
 * Subscribes to a user's unread notifications
 * @param {string} userId - The user ID to listen for
 * @param {string} userRole - The user role to listen for
 * @param {function} callback - Callback function receiving the notifications array
 */
export const subscribeToNotifications = (userId, userRole, callback) => {
  if (!userId) return () => {};

  const q = query(
    collection(db, 'notifications'),
    where('targetUserId', 'in', [userId, userRole]),
    where('read', '==', false)
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    // Sort locally by creation date descending
    notifications.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
      return timeB - timeA;
    });
    
    callback(notifications);
  }, (error) => {
    console.error("Error subscribing to notifications: ", error);
  });
};

/**
 * Marks a notification as read
 * @param {string} notificationId - The document ID of the notification
 */
export const markNotificationRead = async (notificationId) => {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true
    });
  } catch (error) {
    console.error("Error marking notification as read: ", error);
  }
};
