import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useNavigate } from 'react-router-dom';
import NotificationBell from '../NotificationBell';

export default function InventoryDashboard({ profile }) {
  const navigate = useNavigate();
  
  const [stats, setStats] = useState({
    totalCatalogItems: 0,
    lowStockItems: 0,
    totalAssignments: 0
  });
  
  const [recentLogs, setRecentLogs] = useState([]);
  const [lowStockList, setLowStockList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Listen to Inventory
    const unsubInv = onSnapshot(collection(db, 'inventory'), (snap) => {
      let catalog = 0;
      let lowStock = 0;
      const lowItems = [];
      
      snap.forEach(d => {
        const data = { id: d.id, ...d.data() };
        catalog++;
        if (data.availableQuantity <= 5) {
          lowStock++;
          lowItems.push(data);
        }
      });
      
      setStats(prev => ({ ...prev, totalCatalogItems: catalog, lowStockItems: lowStock }));
      setLowStockList(lowItems);
    });

    // 2. Listen to Assignments (Checkouts)
    const qLog = query(collection(db, 'asset_assignments'), orderBy('timestamp', 'desc'), limit(10));
    const unsubLog = onSnapshot(qLog, (snap) => {
      setStats(prev => ({ ...prev, totalAssignments: snap.size }));
      setRecentLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => {
      unsubInv();
      unsubLog();
    };
  }, []);

  if (loading) return <div className="empty-state"><div className="spinner"/></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome, {profile?.fullName?.split(' ')[0] ?? 'Rupali Mam'} 👋</h1>
          <p className="page-subtitle">Inventory & Asset Command Center</p>
        </div>
        <div>
          <NotificationBell />
        </div>
      </div>

      {/* Quick Access Buttons */}
      <div className="grid-auto-200" style={{ gap: '16px', marginBottom: '24px' }}>
        <button className="portal-card" style={{ padding: '20px', cursor: 'pointer', textAlign: 'left', border: '1px solid var(--brand-primary)', background: 'linear-gradient(135deg, rgba(253,180,42,0.1), transparent)' }} onClick={() => navigate('/inventory')}>
          <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--brand-primary)', marginBottom: '8px' }}>inventory_2</span>
          <h3 style={{ fontSize: 16 }}>Stock Catalog</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Manage available items</p>
        </button>
        <button className="portal-card" style={{ padding: '20px', cursor: 'pointer', textAlign: 'left', border: '1px solid #ef4444', background: 'linear-gradient(135deg, rgba(239,68,68,0.1), transparent)' }} onClick={() => navigate('/inventory')}>
          <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#ef4444', marginBottom: '8px' }}>assignment_turned_in</span>
          <h3 style={{ fontSize: 16 }}>Student Kits</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Mark deliveries & returns</p>
        </button>
      </div>

      <div className="grid-1-2" style={{ gap: '24px' }}>
        
        {/* Left Column: Alerts & Low Stock */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="portal-card" style={{ borderLeft: '4px solid #ef4444' }}>
            <h3 style={{ margin: '0 0 8px 0', color: '#ef4444', fontSize: 14 }}>LOW STOCK WARNING</h3>
            <div style={{ fontSize: 24, fontWeight: 'bold' }}>{stats.lowStockItems} Items</div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>Need urgent restock (≤ 5 units)</p>
          </div>

          <div className="portal-card" style={{ borderLeft: '4px solid var(--brand-primary)' }}>
            <h3 style={{ margin: '0 0 8px 0', color: 'var(--brand-primary)', fontSize: 14 }}>CATALOG SIZE</h3>
            <div style={{ fontSize: 24, fontWeight: 'bold' }}>{stats.totalCatalogItems} Categories</div>
          </div>

          {lowStockList.length > 0 && (
            <div className="portal-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: 'var(--surface-bg)', borderBottom: '1px solid var(--surface-border)' }}>
                <h3 style={{ margin: 0, fontSize: 14 }}>Items Needing Restock</h3>
              </div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {lowStockList.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.category}</div>
                    </div>
                    <span className="badge badge-error">{item.availableQuantity} left</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Recent Distribution Ledger */}
        <div className="portal-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px', background: 'var(--surface-bg)', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>📋 Recent Ledger Logs</h2>
            <span className="badge badge-branch-manager">{recentLogs.length} recent actions</span>
          </div>
          <div style={{ padding: 20, flex: 1, overflowY: 'auto' }}>
            {recentLogs.length === 0 ? (
              <div className="empty-state">No recent asset checkouts.</div>
            ) : (
              <div className="table-responsive">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Recipient</th>
                      <th>Item</th>
                      <th>Qty / Size</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLogs.map(log => (
                      <tr key={log.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{log.recipientName}</div>
                          <span className="badge" style={{ fontSize: 10, padding: '2px 6px' }}>{log.recipientType}</span>
                        </td>
                        <td style={{ fontSize: 13 }}>{log.itemName}</td>
                        <td style={{ fontSize: 13 }}>{log.quantity}x {log.size !== 'N/A' && `(${log.size})`}</td>
                        <td>
                          <span className={`badge ${log.action?.includes('Returned') ? 'badge-error' : 'badge-success'}`}>
                            {log.action || 'Assigned'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
