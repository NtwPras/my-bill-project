import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from './firebase';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc, query, where } from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendEmailVerification } from 'firebase/auth';
import { Plus, Wallet, TrendingUp, TrendingDown, Receipt, CheckCircle2, Circle, Trash2, Calendar, X, LogOut } from 'lucide-react';

const CATEGORIES = {
  income: ['เงินเดือน', 'ธุรกิจ/ค้าขาย', 'ดอกเบี้ย/ปันผล', 'อื่นๆ'],
  expense: ['อาหาร/เครื่องดื่ม', 'เดินทาง/พาหนะ', 'ของใช้ส่วนตัว', 'ช้อปปิ้ง', 'อื่นๆ'],
  bill: ['ค่าเช่า/ผ่อนบ้าน', 'ค่าน้ำ/ค่าไฟ', 'ค่าโทรศัพท์/เน็ต', 'บัตรเครดิต', 'อื่นๆ']
};

const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authMessage, setAuthMessage] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(true);

  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    type: 'expense',
    category: CATEGORIES.expense[0],
    amount: '',
    date: new Date().toISOString().split('T')[0],
    note: ''
  });

  // ตรวจสอบสถานะการล็อกอินและอีเมล
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        if (currentUser.emailVerified) {
          setUser(currentUser);
          fetchItems(currentUser.uid);
        } else {
          setUser(null);
          setAuthMessage({ text: 'กรุณายืนยันอีเมลของคุณก่อนเข้าใช้งาน (ตรวจสอบในกล่องจดหมาย)', type: 'error' });
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ฟังก์ชันสมัครและเข้าสู่ระบบ
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMessage({ text: 'กำลังดำเนินการ...', type: 'info' });
    
    try {
      if (isLoginMode) {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        if (!userCred.user.emailVerified) {
          setAuthMessage({ text: 'กรุณายืนยันอีเมลของคุณก่อนเข้าใช้งาน (ตรวจสอบใน Inbox หรือ Junk)', type: 'error' });
          await signOut(auth);
        } else {
          setAuthMessage({ text: '', type: '' });
        }
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCred.user); // ส่งอีเมลยืนยัน
        setAuthMessage({ text: 'สมัครสำเร็จ! เราได้ส่งลิงก์ยืนยันไปที่อีเมลของคุณแล้ว กรุณากดยืนยันก่อนเข้าสู่ระบบ', type: 'success' });
        await signOut(auth);
        setIsLoginMode(true);
        setPassword('');
      }
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        setAuthMessage({ text: 'อีเมลนี้มีผู้ใช้งานแล้ว', type: 'error' });
      } else if (error.code === 'auth/weak-password') {
         setAuthMessage({ text: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', type: 'error' });
      } else {
        setAuthMessage({ text: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', type: 'error' });
      }
    }
  };

  const fetchItems = async (userId: string) => {
    const q = query(collection(db, 'transactions'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const data = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setTransactions(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.amount) return;

    await addDoc(collection(db, 'transactions'), {
      ...formData,
      amount: Number(formData.amount),
      isPaid: false,
      userId: user.uid,
      createdAt: new Date().getTime()
    });

    setIsModalOpen(false);
    setFormData({ ...formData, amount: '', note: '' });
    fetchItems(user.uid);
  };

  const toggleBillStatus = async (id: string, currentStatus: boolean) => {
    await updateDoc(doc(db, 'transactions', id), { isPaid: !currentStatus });
    fetchItems(user.uid);
  };

  const deleteTransaction = async (id: string) => {
    await deleteDoc(doc(db, 'transactions', id));
    fetchItems(user.uid);
  };

  const { filteredTransactions, summary } = useMemo(() => {
    const filtered = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let totalIncome = 0, totalExpense = 0, unpaidBills = 0;

    filtered.forEach(t => {
      const amt = Number(t.amount);
      if (t.type === 'income') totalIncome += amt;
      else if (t.type === 'expense') totalExpense += amt;
      else if (t.type === 'bill') {
        if (t.isPaid) totalExpense += amt;
        else unpaidBills += amt;
      }
    });

    return { 
      filteredTransactions: filtered, 
      summary: { totalIncome, totalExpense, unpaidBills, balance: totalIncome - totalExpense } 
    };
  }, [transactions, selectedMonth, selectedYear]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">กำลังโหลด...</div>;

  // --- หน้าจอล็อกอิน ---
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm">
          <div className="text-center mb-8">
            <Wallet className="w-12 h-12 text-indigo-600 mx-auto mb-2" />
            <h2 className="text-2xl font-bold text-gray-800">MyFinance</h2>
            <p className="text-gray-500 text-sm">จัดการเงินง่ายๆ ในแบบของคุณ</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            <input type="email" placeholder="อีเมล" value={email} onChange={e => setEmail(e.target.value)} required 
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
            <input type="password" placeholder="รหัสผ่าน (6 ตัวขึ้นไป)" value={password} onChange={e => setPassword(e.target.value)} required 
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
            
            {authMessage.text && (
              <div className={`p-3 rounded-lg text-sm ${authMessage.type === 'error' ? 'bg-red-50 text-red-600' : authMessage.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                {authMessage.text}
              </div>
            )}
            
            <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors">
              {isLoginMode ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
            </button>
          </form>
          <p className="text-center mt-6 text-sm text-gray-500">
            {isLoginMode ? 'ยังไม่มีบัญชี? ' : 'มีบัญชีอยู่แล้ว? '}
            <button onClick={() => { setIsLoginMode(!isLoginMode); setAuthMessage({text: '', type: ''}); }} className="text-indigo-600 font-bold hover:underline">
              {isLoginMode ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // --- หน้าแอปพลิเคชันหลัก (ดีไซน์ตามรูปภาพ) ---
  const years = Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="min-h-screen pb-20">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center justify-between w-full sm:w-auto gap-4">
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Wallet className="text-indigo-600" /> จัดการการเงิน
            </h1>
            <button onClick={() => signOut(auth)} className="sm:hidden p-2 text-gray-400 hover:text-red-500"><LogOut size={20}/></button>
          </div>
          <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-lg w-full sm:w-auto justify-center">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="bg-transparent border-none text-sm outline-none cursor-pointer">
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-transparent border-none text-sm outline-none cursor-pointer font-medium">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={() => signOut(auth)} className="hidden sm:flex items-center gap-2 text-sm text-gray-500 hover:text-red-500 transition-colors">
            <LogOut size={16}/> ออกจากระบบ
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="col-span-2 md:col-span-4 bg-[#3b82f6] rounded-2xl p-6 text-white shadow-md">
            <p className="text-blue-100 text-sm font-medium mb-1">ยอดเงินคงเหลือ (เดือนนี้)</p>
            <h2 className="text-4xl font-bold">฿{summary.balance.toLocaleString()}</h2>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 text-emerald-500 mb-2">
              <div className="p-1.5 bg-emerald-50 rounded-lg"><TrendingUp className="w-4 h-4" /></div>
              <p className="text-xs font-semibold">รายรับ</p>
            </div>
            <p className="text-lg font-bold text-gray-800">฿{summary.totalIncome.toLocaleString()}</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 text-rose-500 mb-2">
              <div className="p-1.5 bg-rose-50 rounded-lg"><TrendingDown className="w-4 h-4" /></div>
              <p className="text-xs font-semibold">รายจ่าย</p>
            </div>
            <p className="text-lg font-bold text-gray-800">฿{summary.totalExpense.toLocaleString()}</p>
          </div>
          
          <div className="col-span-2 bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex justify-between items-center">
             <div>
                <div className="flex items-center gap-2 text-amber-500 mb-2">
                  <div className="p-1.5 bg-amber-50 rounded-lg"><Receipt className="w-4 h-4" /></div>
                  <p className="text-xs font-semibold">บิลที่ยังไม่จ่าย</p>
                </div>
                <p className="text-lg font-bold text-gray-800">฿{summary.unpaidBills.toLocaleString()}</p>
             </div>
             {summary.unpaidBills > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">รอชำระ</span>}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-lg font-bold text-gray-800">รายการเดือนนี้</h3>
            <span className="text-sm text-gray-500">{filteredTransactions.length} รายการ</span>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="bg-white rounded-xl p-10 text-center border border-gray-100 border-dashed shadow-sm">
              <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">ยังไม่มีรายการในเดือนนี้</p>
              <p className="text-xs text-gray-400 mt-1">กดปุ่ม + ด้านล่างเพื่อเพิ่มรายการ</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTransactions.map((t) => (
                <div key={t.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-50 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    {t.type === 'bill' ? (
                      <button onClick={() => toggleBillStatus(t.id, t.isPaid)} className={`shrink-0 transition-colors ${t.isPaid ? 'text-emerald-500' : 'text-gray-300'}`}>
                        {t.isPaid ? <CheckCircle2 className="w-8 h-8" /> : <Circle className="w-8 h-8" />}
                      </button>
                    ) : (
                      <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${t.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                        {t.type === 'income' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-semibold truncate ${t.type === 'bill' && t.isPaid ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{t.category}</p>
                        {t.type === 'bill' && <span className={`text-[10px] px-1.5 py-0.5 rounded-sm ${t.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{t.isPaid ? 'จ่ายแล้ว' : 'บิล'}</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <span>{new Date(t.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                        {t.note && <><span>•</span><span className="truncate max-w-[120px]">{t.note}</span></>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className={`font-bold whitespace-nowrap ${t.type === 'income' ? 'text-emerald-500' : t.type === 'expense' || t.isPaid ? 'text-gray-800' : 'text-amber-500'}`}>
                      {t.type === 'income' ? '+' : '-'}฿{t.amount.toLocaleString()}
                    </p>
                    <button onClick={() => deleteTransaction(t.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <button onClick={() => setIsModalOpen(true)} className="fixed bottom-6 right-6 lg:right-1/2 lg:translate-x-[350px] w-14 h-14 bg-[#5b5bfa] hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-all">
        <Plus className="w-6 h-6" />
      </button>

      {/* หน้าต่าง Popup เพิ่มรายการ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">เพิ่มรายการใหม่</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-3 gap-2 bg-gray-100 p-1 rounded-xl">
                {(['expense', 'income', 'bill'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setFormData({ ...formData, type: t, category: CATEGORIES[t][0] })}
                    className={`py-2 text-sm font-medium rounded-lg transition-all ${formData.type === t ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}>
                    {t === 'expense' ? 'รายจ่าย' : t === 'income' ? 'รายรับ' : 'บิล'}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนเงิน (บาท)</label>
                <input type="number" required min="0" step="0.01" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="w-full text-2xl font-bold p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0.00" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่</label>
                  <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                    {CATEGORIES[formData.type as keyof typeof CATEGORIES].map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">วันที่</label>
                  <input type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">บันทึกเพิ่มเติม (ไม่บังคับ)</label>
                <input type="text" value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="เช่น ซื้อกาแฟ, ค่าเน็ตมือถือ..." />
              </div>
              <button type="submit" className="w-full py-3 bg-[#5b5bfa] hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors">บันทึกรายการ</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}