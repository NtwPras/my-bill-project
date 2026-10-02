import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { PlusCircle, Trash2, CheckCircle, Circle } from 'lucide-react';

export default function App() {
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('รายจ่าย');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setItems(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount) return;

    await addDoc(collection(db, 'transactions'), {
      title,
      amount: parseFloat(amount),
      type,
      isPaid: false,
      createdAt: new Date()
    });

    setTitle('');
    setAmount('');
    fetchItems();
  };

  const toggleBillStatus = async (id: string, currentStatus: boolean) => {
    const itemRef = doc(db, 'transactions', id);
    await updateDoc(itemRef, { isPaid: !currentStatus });
    fetchItems();
  };

  const deleteItem = async (id: string) => {
    await deleteDoc(doc(db, 'transactions', id));
    fetchItems();
  };

  const totalIncome = items.filter(i => i.type === 'รายรับ').reduce((sum, i) => sum + i.amount, 0);
  const totalExpense = items.filter(i => i.type === 'รายจ่าย' || (i.type === 'บิล' && i.isPaid)).reduce((sum, i) => sum + i.amount, 0);
  const pendingBills = items.filter(i => i.type === 'บิล' && !i.isPaid).reduce((sum, i) => sum + i.amount, 0);
  const balance = totalIncome - totalExpense;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#333' }}>จัดการรายรับ-รายจ่าย</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
        <div style={{ padding: '15px', background: '#e0f2fe', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#0369a1' }}>คงเหลือ</p>
          <h2 style={{ margin: 0 }}>฿{balance.toLocaleString()}</h2>
        </div>
        <div style={{ padding: '15px', background: '#fef08a', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#a16207' }}>บิลค้างจ่าย</p>
          <h2 style={{ margin: 0 }}>฿{pendingBills.toLocaleString()}</h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input 
          placeholder="ชื่อรายการ" value={title} onChange={(e) => setTitle(e.target.value)}
          style={{ flex: 1, padding: '8px' }} required 
        />
        <input 
          type="number" placeholder="จำนวนเงิน" value={amount} onChange={(e) => setAmount(e.target.value)}
          style={{ width: '100px', padding: '8px' }} required 
        />
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ padding: '8px' }}>
          <option value="รายจ่าย">รายจ่าย</option>
          <option value="รายรับ">รายรับ</option>
          <option value="บิล">บิล</option>
        </select>
        <button type="submit" style={{ padding: '8px 15px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px' }}>
          <PlusCircle size={20} />
        </button>
      </form>

      <div>
        {items.map(item => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #eee' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {item.type === 'บิล' && (
                <div onClick={() => toggleBillStatus(item.id, item.isPaid)} style={{ cursor: 'pointer', color: item.isPaid ? '#22c55e' : '#94a3b8' }}>
                  {item.isPaid ? <CheckCircle /> : <Circle />}
                </div>
              )}
              <span>{item.title}</span>
              <span style={{ fontSize: '0.8em', padding: '2px 6px', borderRadius: '4px', background: '#f1f5f9' }}>{item.type}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: item.type === 'รายรับ' ? '#22c55e' : '#ef4444' }}>
                {item.type === 'รายรับ' ? '+' : '-'}฿{item.amount.toLocaleString()}
              </span>
              <button onClick={() => deleteItem(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}