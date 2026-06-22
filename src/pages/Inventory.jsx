import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, doc, setDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import './Inventory.css';

const CATEGORIES = ['All', 'Books', 'Uniforms', 'Electronics', 'Supplies'];

const DEFAULT_ITEMS = [
  { name: 'T-Shirt (Collar) [C]', category: 'Uniforms', totalQuantity: 120, availableQuantity: 120, sizes: 'S, M, L, XL' },
  { name: 'T-Shirt (Zip) [Z]', category: 'Uniforms', totalQuantity: 80, availableQuantity: 80, sizes: 'S, M, L, XL' },
  { name: 'T-Shirt (Round Neck) [R]', category: 'Uniforms', totalQuantity: 100, availableQuantity: 100, sizes: 'S, M, L, XL' },
  { name: 'Shishyakul Bag', category: 'Supplies', totalQuantity: 200, availableQuantity: 200, sizes: '' },
  { name: 'Oswal Question Bank Kit', category: 'Books', totalQuantity: 150, availableQuantity: 150, sizes: '' },
  { name: 'The Alchemist (Self Help)', category: 'Books', totalQuantity: 50, availableQuantity: 50, sizes: '' },
  { name: 'Atomic Habits (Self Help)', category: 'Books', totalQuantity: 50, availableQuantity: 50, sizes: '' },
  { name: 'Chanakya Niti (Self Help)', category: 'Books', totalQuantity: 100, availableQuantity: 100, sizes: '' },
  { name: 'Hanuman Chalisa Book', category: 'Books', totalQuantity: 300, availableQuantity: 300, sizes: '' },
  { name: 'Whiteboard Markers (Box)', category: 'Supplies', totalQuantity: 25, availableQuantity: 25, sizes: '' },
  { name: 'Office Projector', category: 'Electronics', totalQuantity: 3, availableQuantity: 3, sizes: '' }
];

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('checklist'); // 'checklist' or 'stock'

  // Form States: New Item
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'Books',
    totalQuantity: '',
    sizes: ''
  });

  // Form States: Restock Modal
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockItemId, setRestockItemId] = useState(null);
  const [restockAmount, setRestockAmount] = useState('');

  // Form States: Distribution
  const [distribution, setDistribution] = useState({
    recipientType: 'student',
    recipientId: '',
    itemId: '',
    size: '',
    quantity: '1'
  });

  // Local state for temporary dropdown selection in student kit checklist rows
  const [rowTshirtSelections, setRowTshirtSelections] = useState({});

  useEffect(() => {
    // 1. Listen to Inventory
    const qInv = query(collection(db, 'inventory'));
    const unsubInv = onSnapshot(qInv, async (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Auto seed if empty
      if (data.length === 0) {
        setLoading(true);
        for (const item of DEFAULT_ITEMS) {
          const docRef = doc(collection(db, 'inventory'));
          await setDoc(docRef, item);
        }
        setLoading(false);
      } else {
        setItems(data);
      }
    });

    // 2. Fetch Admitted Students
    const qStu = query(collection(db, 'students'), where('status', '==', 'admitted'));
    const unsubStu = onSnapshot(qStu, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(data);
    });

    // 3. Fetch Staff users
    const qStaff = query(collection(db, 'users'));
    const unsubStaff = onSnapshot(qStaff, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStaff(data);
    });

    // 4. Listen to Asset Assignments log
    const qLog = query(collection(db, 'asset_assignments'));
    const unsubLog = onSnapshot(qLog, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sorted = data.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setAssignments(sorted);
    });

    return () => {
      unsubInv();
      unsubStu();
      unsubStaff();
      unsubLog();
    };
  }, []);

  const handleCreateItem = async (e) => {
    e.preventDefault();
    if (!newItem.name || !newItem.totalQuantity) return alert('Fill required fields!');

    try {
      const qNum = Number(newItem.totalQuantity);
      await addDoc(collection(db, 'inventory'), {
        name: newItem.name.trim(),
        category: newItem.category,
        totalQuantity: qNum,
        availableQuantity: qNum,
        sizes: newItem.sizes.trim()
      });

      setNewItem({ name: '', category: 'Books', totalQuantity: '', sizes: '' });
      alert('Asset item registered successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to register item.');
    }
  };

  const handleOpenRestock = (item) => {
    setRestockItemId(item.id);
    setRestockAmount('');
    setShowRestockModal(true);
  };

  const handleRestockSubmit = async () => {
    const amount = Number(restockAmount);
    if (!amount || amount <= 0) return alert('Enter a valid amount!');

    try {
      const item = items.find(i => i.id === restockItemId);
      if (!item) return;

      await updateDoc(doc(db, 'inventory', restockItemId), {
        totalQuantity: item.totalQuantity + amount,
        availableQuantity: item.availableQuantity + amount
      });

      setShowRestockModal(false);
      setRestockItemId(null);
      alert(`Restocked ${amount} units of ${item.name}!`);
    } catch (err) {
      console.error(err);
      alert('Failed to restock.');
    }
  };

  const handleDistribute = async (e) => {
    e.preventDefault();
    const { recipientId, itemId, quantity, size, recipientType } = distribution;
    if (!recipientId || !itemId || !quantity) return alert('Select recipient, asset, and quantity!');

    const targetQty = Number(quantity);
    if (targetQty <= 0) return alert('Enter valid quantity!');

    const item = items.find(i => i.id === itemId);
    if (!item) return;

    if (item.availableQuantity < targetQty) {
      return alert(`Insufficient stock! Only ${item.availableQuantity} units available.`);
    }

    let recipientName = 'Unknown';
    if (recipientType === 'student') {
      const targetStu = students.find(s => s.id === recipientId);
      recipientName = targetStu ? targetStu.studentName : 'Student';
    } else {
      const targetUser = staff.find(u => u.id === recipientId);
      recipientName = targetUser ? targetUser.displayName || targetUser.email : 'Staff';
    }

    try {
      await updateDoc(doc(db, 'inventory', itemId), {
        availableQuantity: item.availableQuantity - targetQty
      });

      await addDoc(collection(db, 'asset_assignments'), {
        itemId,
        itemName: item.name,
        recipientId,
        recipientName,
        recipientType,
        quantity: targetQty,
        size: size || 'N/A',
        timestamp: serverTimestamp()
      });

      setDistribution(prev => ({
        ...prev,
        itemId: '',
        size: '',
        quantity: '1'
      }));

      alert(`Successfully assigned ${targetQty}x ${item.name} to ${recipientName}!`);
    } catch (err) {
      console.error(err);
      alert('Failed to distribute asset.');
    }
  };

  // Student Handover checklist logic
  const handleKitCheckchange = async (student, itemKey, isChecked) => {
    const studentId = student.id;
    const currentHandover = student.kitHandover || {};

    let itemSearchName = '';
    let options = {};

    if (itemKey === 'tshirt') {
      const sel = rowTshirtSelections[studentId] || { style: 'C', size: 'M' };
      options = { style: sel.style, size: sel.size };
      
      const styleName = sel.style === 'C' ? 'Collar' : sel.style === 'Z' ? 'Zip' : 'Round Neck';
      itemSearchName = `T-Shirt (${styleName}) [${sel.style}]`;
    } else if (itemKey === 'bag') {
      itemSearchName = 'Shishyakul Bag';
    } else if (itemKey === 'oswalKit') {
      itemSearchName = 'Oswal Question Bank Kit';
    } else if (itemKey === 'hanumanChalisa') {
      itemSearchName = 'Hanuman Chalisa Book';
    } else if (itemKey === 'selfHelpBook') {
      const std = student.standard || '10th';
      if (std.includes('8')) itemSearchName = 'The Alchemist (Self Help)';
      else if (std.includes('9')) itemSearchName = 'Atomic Habits (Self Help)';
      else itemSearchName = 'Chanakya Niti (Self Help)';
    }

    const invItem = items.find(i => i.name.toLowerCase() === itemSearchName.toLowerCase());
    
    if (isChecked && invItem && invItem.availableQuantity <= 0) {
      return alert(`Cannot hand over! ${invItem.name} is out of stock.`);
    }

    try {
      const updatedHandover = {
        ...currentHandover,
        [itemKey]: isChecked ? {
          handedOver: true,
          date: new Date().toISOString().split('T')[0],
          ...options
        } : null
      };
      
      if (!isChecked) {
        delete updatedHandover[itemKey];
      }

      // Update student
      await updateDoc(doc(db, 'students', studentId), {
        kitHandover: updatedHandover
      });

      // Update inventory stock
      if (invItem) {
        await updateDoc(doc(db, 'inventory', invItem.id), {
          availableQuantity: isChecked ? invItem.availableQuantity - 1 : invItem.availableQuantity + 1
        });
      }

      // Log assignment
      await addDoc(collection(db, 'asset_assignments'), {
        itemId: invItem ? invItem.id : 'unknown',
        itemName: itemSearchName,
        recipientId: studentId,
        recipientName: student.studentName,
        recipientType: 'student',
        quantity: 1,
        size: options.size || 'N/A',
        action: isChecked ? 'Handover Checklist' : 'Checklist Returned',
        timestamp: serverTimestamp()
      });

      alert(`Checklist updated! ${isChecked ? 'Delivered' : 'Returned'} ${itemSearchName} to ${student.studentName}.`);
    } catch (err) {
      console.error('Failed to update student kit handover checklist', err);
      alert('Error updating checklist.');
    }
  };

  const handleRowTshirtChange = (studentId, field, value) => {
    setRowTshirtSelections(prev => {
      const current = prev[studentId] || { style: 'C', size: 'M' };
      return {
        ...prev,
        [studentId]: {
          ...current,
          [field]: value
        }
      };
    });
  };

  const filteredItems = selectedCategory === 'All' 
    ? items 
    : items.filter(i => i.category === selectedCategory);

  return (
    <div className="inventory-container">
      <div className="inventory-header-block">
        <div>
          <h1>Branch Asset & Inventory Hub</h1>
          <p>Logged in as Rupali More (Inventory Guardian) • Log stock items, track deliveries, and view checklists.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="attendance-tabs">
        <button 
          className={`tab-btn ${activeTab === 'checklist' ? 'active' : ''}`}
          onClick={() => setActiveTab('checklist')}
        >
          <span className="material-symbols-outlined">assignment_turned_in</span>
          Student Handover Checklist
        </button>
        <button 
          className={`tab-btn ${activeTab === 'stock' ? 'active' : ''}`}
          onClick={() => setActiveTab('stock')}
        >
          <span className="material-symbols-outlined">inventory_2</span>
          Manage Stock Catalog
        </button>
      </div>

      {activeTab === 'checklist' ? (
        <div className="portal-card student-checklist-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2>📋 Admitted Student Kit Checklist</h2>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Tracks T-shirts, Bags, Books, and Kits.</span>
          </div>

          {students.length === 0 ? (
            <div className="empty-state">
              <span className="material-symbols-outlined">group_off</span>
              <p>No admitted students found. Admissions pipeline must confirm students first.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="portal-table checklist-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Batch</th>
                  <th>Uniform T-Shirt [C / Z / R]</th>
                  <th>Shishyakul Bag</th>
                  <th>Oswal Kit</th>
                  <th>Hanuman Chalisa</th>
                  <th>Self Help Book</th>
                </tr>
              </thead>
              <tbody>
                {students.map(student => {
                  const kit = student.kitHandover || {};
                  
                  // Local row variables
                  const tshirtSel = rowTshirtSelections[student.id] || { style: 'C', size: 'M' };
                  const hasTshirt = !!kit.tshirt;
                  const hasBag = !!kit.bag;
                  const hasOswal = !!kit.oswalKit;
                  const hasChalisa = !!kit.hanumanChalisa;
                  const hasSelfHelp = !!kit.selfHelpBook;

                  const std = student.standard || '10th';
                  const selfHelpTitle = std.includes('8') ? 'The Alchemist' : std.includes('9') ? 'Atomic Habits' : 'Chanakya Niti';

                  return (
                    <tr key={student.id}>
                      <td><strong>{student.studentName}</strong></td>
                      <td><span className="badge badge-branch-manager">{student.batch || 'Pending'}</span></td>
                      
                      {/* T-Shirt Column */}
                      <td>
                        <div className="checklist-tshirt-cell">
                          {hasTshirt ? (
                            <span className="handover-confirmed-label">
                              ✅ {kit.tshirt.style} ({kit.tshirt.size})
                            </span>
                          ) : (
                            <div className="tshirt-options-row">
                              <select 
                                value={tshirtSel.style} 
                                onChange={e => handleRowTshirtChange(student.id, 'style', e.target.value)}
                                className="portal-select table-input"
                              >
                                <option value="C">Collar [C]</option>
                                <option value="Z">Zip [Z]</option>
                                <option value="R">Round [R]</option>
                              </select>
                              <select 
                                value={tshirtSel.size} 
                                onChange={e => handleRowTshirtChange(student.id, 'size', e.target.value)}
                                className="portal-select table-input"
                              >
                                <option value="S">S</option>
                                <option value="M">M</option>
                                <option value="L">L</option>
                                <option value="XL">XL</option>
                              </select>
                            </div>
                          )}
                          <input 
                            type="checkbox"
                            checked={hasTshirt}
                            onChange={e => handleKitCheckchange(student, 'tshirt', e.target.checked)}
                          />
                        </div>
                      </td>

                      {/* Bag Column */}
                      <td>
                        <div className="checklist-check-cell">
                          <input 
                            type="checkbox"
                            checked={hasBag}
                            onChange={e => handleKitCheckchange(student, 'bag', e.target.checked)}
                          />
                          {hasBag && <span className="handover-date">{kit.bag.date}</span>}
                        </div>
                      </td>

                      {/* Oswal Kit Column */}
                      <td>
                        <div className="checklist-check-cell">
                          <input 
                            type="checkbox"
                            checked={hasOswal}
                            onChange={e => handleKitCheckchange(student, 'oswalKit', e.target.checked)}
                          />
                          {hasOswal && <span className="handover-date">{kit.oswalKit.date}</span>}
                        </div>
                      </td>

                      {/* Hanuman Chalisa */}
                      <td>
                        <div className="checklist-check-cell">
                          <input 
                            type="checkbox"
                            checked={hasChalisa}
                            onChange={e => handleKitCheckchange(student, 'hanumanChalisa', e.target.checked)}
                          />
                          {hasChalisa && <span className="handover-date">{kit.hanumanChalisa.date}</span>}
                        </div>
                      </td>
                      
                      {/* Self Help Book */}
                      <td>
                        <div className="checklist-check-cell" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input 
                              type="checkbox"
                              checked={hasSelfHelp}
                              onChange={e => handleKitCheckchange(student, 'selfHelpBook', e.target.checked)}
                            />
                            {hasSelfHelp && <span className="handover-date">{kit.selfHelpBook.date}</span>}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {selfHelpTitle}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>
      ) : (
        <>
          {/* Grid: Stats and Action Forms */}
          <div className="inventory-dashboard-grid">
            
            {/* Form 1: Register/Add Stock Item */}
            <div className="portal-card inventory-form-card">
              <h2>📦 Add New Asset Profile</h2>
              <form onSubmit={handleCreateItem}>
                <div className="form-group">
                  <label className="form-label">Asset Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Class 10 Science Textbook" 
                    value={newItem.name}
                    onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                    className="portal-input"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select 
                    value={newItem.category}
                    onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                    className="portal-select"
                  >
                    <option value="Books">Books</option>
                    <option value="Uniforms">Uniforms</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Supplies">Classroom Supplies</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Initial Quantity</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 50" 
                    value={newItem.totalQuantity}
                    onChange={e => setNewItem({ ...newItem, totalQuantity: e.target.value })}
                    className="portal-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Available Sizes (Comma separated, optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. S, M, L, XL" 
                    value={newItem.sizes}
                    onChange={e => setNewItem({ ...newItem, sizes: e.target.value })}
                    className="portal-input"
                  />
                </div>

                <button type="submit" className="btn btn-brand" style={{ width: '100%', marginTop: '8px' }}>
                  <span className="material-symbols-outlined">add_circle</span>
                  Add Asset to Catalog
                </button>
              </form>
            </div>

            {/* Form 2: Distribute Asset to Student or Staff */}
            <div className="portal-card inventory-form-card">
              <h2>🤝 Assign & Distribute Asset</h2>
              <form onSubmit={handleDistribute}>
                <div className="form-group">
                  <label className="form-label">Recipient Type</label>
                  <div className="recipient-type-picker">
                    <button 
                      type="button" 
                      className={`type-btn ${distribution.recipientType === 'student' ? 'active' : ''}`}
                      onClick={() => setDistribution({ ...distribution, recipientType: 'student', recipientId: '' })}
                    >
                      Student
                    </button>
                    <button 
                      type="button" 
                      className={`type-btn ${distribution.recipientType === 'staff' ? 'active' : ''}`}
                      onClick={() => setDistribution({ ...distribution, recipientType: 'staff', recipientId: '' })}
                    >
                      Staff
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Select Recipient</label>
                  <select 
                    value={distribution.recipientId}
                    onChange={e => setDistribution({ ...distribution, recipientId: e.target.value })}
                    className="portal-select"
                    required
                  >
                    <option value="">-- Choose {distribution.recipientType === 'student' ? 'Student' : 'Staff'} --</option>
                    {distribution.recipientType === 'student' ? (
                      students.map(s => <option key={s.id} value={s.id}>{s.studentName} ({s.standard || 'Admitted'})</option>)
                    ) : (
                      staff.map(u => <option key={u.id} value={u.id}>{u.displayName || u.email} ({u.role || 'Staff'})</option>)
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Select Asset Item</label>
                  <select 
                    value={distribution.itemId}
                    onChange={e => {
                      const item = items.find(i => i.id === e.target.value);
                      setDistribution({ ...distribution, itemId: e.target.value, size: item && item.sizes ? item.sizes.split(',')[0].trim() : '' });
                    }}
                    className="portal-select"
                    required
                  >
                    <option value="">-- Choose Asset --</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.name} (Stock: {i.availableQuantity})</option>)}
                  </select>
                </div>

                <div className="grid-2-form" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Quantity</label>
                    <input 
                      type="number" 
                      value={distribution.quantity}
                      onChange={e => setDistribution({ ...distribution, quantity: e.target.value })}
                      className="portal-input"
                      min="1"
                      required
                    />
                  </div>

                  {distribution.itemId && items.find(i => i.id === distribution.itemId)?.sizes && (
                    <div className="form-group">
                      <label className="form-label">Size</label>
                      <select 
                        value={distribution.size}
                        onChange={e => setDistribution({ ...distribution, size: e.target.value })}
                        className="portal-select"
                      >
                        {items.find(i => i.id === distribution.itemId).sizes.split(',').map(sz => (
                          <option key={sz} value={sz.trim()}>{sz.trim()}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <button type="submit" className="btn btn-brand" style={{ width: '100%', marginTop: '8px' }}>
                  <span className="material-symbols-outlined">handshake</span>
                  Confirm Distribution
                </button>
              </form>
            </div>

          </div>

          {/* Category Tabs */}
          <div className="category-tabs">
            {CATEGORIES.map(cat => (
              <button 
                key={cat} 
                className={`cat-btn ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid: Stock Card Inventory List */}
          {loading ? (
            <p>Syncing asset inventory catalog...</p>
          ) : (
            <div className="inventory-stock-grid">
              {filteredItems.map(item => {
                const pct = item.totalQuantity > 0 ? (item.availableQuantity / item.totalQuantity) * 100 : 0;
                const isLow = item.availableQuantity <= 5;
                
                return (
                  <div key={item.id} className={`inventory-card ${isLow ? 'low-stock' : ''}`}>
                    <div className="card-header-badge">
                      <span className={`badge-tag ${item.category.toLowerCase()}`}>{item.category}</span>
                      {isLow && <span className="low-badge">Low Stock</span>}
                    </div>
                    
                    <h3>{item.name}</h3>
                    
                    {item.sizes && <p className="sizes-meta">Sizes: <strong>{item.sizes}</strong></p>}
                    
                    <div className="stock-meter-container">
                      <div className="stock-numeric">
                        <span>Available: <strong>{item.availableQuantity}</strong> / {item.totalQuantity}</span>
                        <span>{pct.toFixed(0)}%</span>
                      </div>
                      <div className="meter-bg">
                        <div 
                          className={`meter-fill ${isLow ? 'low' : ''}`} 
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="card-actions">
                      <button className="btn-manual-pay btn-sm" onClick={() => handleOpenRestock(item)}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>restart_alt</span>
                        Restock Stock
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Assignments History Section */}
      <div className="portal-card assignments-history-card">
        <h2>📋 Real-time Distribution Ledger Logs</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>List of books, materials, and t-shirts delivered to parents/students.</p>
        
        {assignments.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No logs created yet. Distribute an asset to populate the history ledger.</p>
        ) : (
        <div className="table-responsive">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Recipient Name</th>
                <th>Type</th>
                <th>Delivered Asset</th>
                <th>Quantity</th>
                <th>Specs / Size</th>
                <th>Action / Status</th>
                <th>Delivery Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map(log => (
                <tr key={log.id}>
                  <td><strong>{log.recipientName}</strong></td>
                  <td>
                    <span className={`badge ${log.recipientType === 'student' ? 'badge-admin' : 'badge-branch-manager'}`}>
                      {log.recipientType}
                    </span>
                  </td>
                  <td>{log.itemName}</td>
                  <td>{log.quantity} unit{log.quantity > 1 ? 's' : ''}</td>
                  <td>{log.size || 'N/A'}</td>
                  <td>
                    <span className={`badge ${log.action?.includes('Returned') ? 'badge-error' : 'badge-success'}`}>
                      {log.action || 'Manual Distribute'}
                    </span>
                  </td>
                  <td>{log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString() : 'Saving...'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Restock Modal */}
      {showRestockModal && (
        <div className="fees-modal-overlay">
          <div className="fees-modal">
            <h2>📈 Restock Asset</h2>
            <p>Add units to the total and available count for this catalog item.</p>
            
            <div className="form-group">
              <label className="form-label">Quantity to Add</label>
              <input 
                type="number" 
                placeholder="e.g. 50" 
                value={restockAmount} 
                onChange={e => setRestockAmount(e.target.value)} 
                className="portal-input"
                min="1"
                required
              />
            </div>

            <div className="modal-footer">
              <button 
                className="btn btn-ghost" 
                onClick={() => {
                  setShowRestockModal(false);
                  setRestockItemId(null);
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-brand" 
                onClick={handleRestockSubmit}
              >
                Update Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
