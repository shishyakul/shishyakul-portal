import { collection, addDoc, query, where, onSnapshot, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const subscribeToInbox = (userRole, userId, callback) => {
  const q = query(
    collection(db, 'portal_tickets'),
    where('targetRole', 'in', [userRole, userId])
  );
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // In-memory sort to bypass composite index requirement
    data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    callback(data);
  });
};

export const subscribeToSent = (uid, callback) => {
  const q = query(
    collection(db, 'portal_tickets'),
    where('senderUid', '==', uid)
  );
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // In-memory sort to bypass composite index requirement
    data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    callback(data);
  });
};

export const createTickets = async (senderUid, senderName, senderRole, targetRoles, subject, message) => {
  const batchPromises = targetRoles.map(targetRole => {
    return addDoc(collection(db, 'portal_tickets'), {
      senderUid,
      senderName,
      senderRole,
      targetRole,
      subject,
      message,
      status: 'pending',
      createdAt: serverTimestamp()
    });
  });
  
  await Promise.all(batchPromises);
};

export const updateTicketStatus = async (ticketId, newStatus) => {
  const ticketRef = doc(db, 'portal_tickets', ticketId);
  await updateDoc(ticketRef, {
    status: newStatus
  });
};
