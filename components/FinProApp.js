'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, List, PieChart, User, Moon, LogOut, 
  Home, Plus, Settings, TrendingUp, TrendingDown, 
  CheckCircle, Trash2, Lock, FileText, Zap, Edit, RefreshCw
} from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
// Use dois pontos (..) para voltar uma pasta e entrar em lib
import { supabase } from '../lib/supabase';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function FinProApp() {
  // --- ESTADOS ---
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false); // Estado de carregamento
  const [activeTab, setActiveTab] = useState('home');
  const [showModal, setShowModal] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);

  // Separamos: Transações vêm do Banco, User vem do LocalStorage
  const [transactions, setTransactions] = useState([]);
  const [user, setUser] = useState({ name: "Usuário", goal: 2000, pass: "", dark: false, logged: false });

  // Estados de formulário
  const [authPass, setAuthPass] = useState('');
  const [authError, setAuthError] = useState('');
  const [form, setForm] = useState({ desc: '', val: '', type: 'out', cat: 'Outros' });
  const [profileForm, setProfileForm] = useState({ name: '', goal: '', pass: '' });

  const pdfRef = useRef(); 

  // --- 1. CARREGAR DADOS ---
  
  useEffect(() => {
    setMounted(true);
    
    // Carrega configurações locais (Tema, Senha, Meta)
    const localUser = localStorage.getItem('finpro_user_config');
    if (localUser) {
      const parsedUser = JSON.parse(localUser);
      setUser(parsedUser);
      if (parsedUser.dark) document.body.classList.add('dark-mode');
    }

    // Busca transações do Supabase
    fetchTransactions();
  }, []);

  // Salva configurações locais sempre que mudar
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('finpro_user_config', JSON.stringify(user));
      if (user.dark) document.body.classList.add('dark-mode');
      else document.body.classList.remove('dark-mode');
    }
  }, [user, mounted]);


  // --- FUNÇÕES DO SUPABASE ---

  async function fetchTransactions() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false }); // Mais recentes primeiro

      if (error) throw error;

      // Mapeia os dados do banco para o formato do app
      const formatted = data.map(item => ({
        id: item.id,
        desc: item.description,
        val: parseFloat(item.value),
        cat: item.category,
        date: item.date_display,
        type: item.type
      }));

      setTransactions(formatted);
    } catch (error) {
      console.error('Erro ao buscar:', error);
      showToast('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }

  async function saveTransaction() {
    if (!form.desc || !form.val) return;
    setLoading(true);

    const valFloat = parseFloat(form.val);
    const finalVal = form.type === 'out' ? -valFloat : valFloat;
    const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

    try {
      if (editingId) {
        // ATUALIZAR (UPDATE)
        const { error } = await supabase
          .from('transactions')
          .update({
            description: form.desc,
            value: finalVal,
            category: form.cat,
            type: form.type
          })
          .eq('id', editingId);

        if (error) throw error;
        showToast("Transação atualizada!");

      } else {
        // CRIAR (INSERT)
        const { error } = await supabase
          .from('transactions')
          .insert([{
            description: form.desc,
            value: finalVal,
            category: form.cat,
            date_display: dateStr,
            type: form.type
          }]);

        if (error) throw error;
        showToast("Transação salva na nuvem!");
      }

      await fetchTransactions(); // Recarrega a lista
      closeModal();

    } catch (error) {
      console.error('Erro ao salvar:', error);
      showToast('Erro ao salvar dados.');
    } finally {
      setLoading(false);
    }
  }

  async function deleteEntry(id) {
    if (!confirm("Excluir permanentemente?")) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      
      // Remove da lista localmente para ser rápido
      setTransactions(prev => prev.filter(t => t.id !== id));
      showToast("Item excluído.");
    } catch (error) {
      console.error(error);
      showToast('Erro ao excluir.');
    } finally {
      setLoading(false);
    }
  }

  // --- LÓGICA DE UI E AUTH ---

  const handleAuth = () => {
    if (!user.pass) {
      if (authPass.length < 4) return setAuthError("Mínimo 4 caracteres.");
      setUser({ ...user, pass: authPass, logged: true });
    } else {
      if (authPass === user.pass) setUser({ ...user, logged: true });
      else { setAuthError("Senha incorreta."); setAuthPass(''); }
    }
  };

  const handleEdit = (t) => {
    setForm({
      desc: t.desc,
      val: Math.abs(t.val),
      type: t.val < 0 ? 'out' : 'in',
      cat: t.cat
    });
    setEditingId(t.id);
    setShowModal(true);
  };

  const closeModal = () => {
    setForm({ desc: '', val: '', type: 'out', cat: 'Outros' });
    setEditingId(null);
    setShowModal(false);
  };

  const saveProfile = () => {
    setUser({
      ...user,
      name: profileForm.name || user.name,
      goal: parseFloat(profileForm.goal) || user.goal,
      pass: profileForm.pass || user.pass
    });
    showToast('Perfil salvo (Local)!');
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // --- CÁLCULOS ---
  
  const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const tin = transactions.filter(t => t.val > 0).reduce((a, b) => a + b.val, 0);
  const tout = Math.abs(transactions.filter(t => t.val < 0).reduce((a, b) => a + b.val, 0));
  const bal = tin - tout;
  const perc = user.goal > 0 ? Math.min((tout / user.goal) * 100, 100) : 0;
  const filteredTransactions = transactions.filter(t => t.desc.toLowerCase().includes(searchTerm.toLowerCase()));

  const chartData = {
    labels: [...new Set(transactions.filter(t => t.val < 0).map(t => t.cat))],
    datasets: [{
      data: [...new Set(transactions.filter(t => t.val < 0).map(t => t.cat))].map(c => 
        Math.abs(transactions.filter(t => t.cat === c && t.val < 0).reduce((s, t) => s + t.val, 0))
      ),
      backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
      borderWidth: 0
    }]
  };

  // --- PDF ---
  const exportPDF = async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    const element = pdfRef.current;
    element.style.display = 'block'; 
    html2pdf().from(element).set({ margin: 1, filename: 'finpro_db.pdf', html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter' } }).save().then(() => element.style.display = 'none');
  };

  // --- RENDER ---
  if (!mounted) return null;

  if (!user.logged) {
    return (
      <div className="wrapper" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, background: 'var(--primary)', color: 'white', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}><Lock size={30} /></div>
          <h2>{!user.pass ? "Crie sua Senha" : "FinPro Elite"}</h2>
          <p style={{ color: 'var(--text-sub)', marginBottom: 25 }}>{!user.pass ? "Proteja seus dados locais." : "Digite sua senha."}</p>
          <input type="password" placeholder="Senha" value={authPass} onChange={(e) => setAuthPass(e.target.value)} />
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleAuth}>Entrar</button>
          {authError && <p style={{ color: 'var(--danger)', marginTop: 15 }}>{authError}</p>}
        </div>
      </div>
    );
  }

  return (
    <>
      {toastMsg && <div className="toast-container" style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999 }}><div className="card" style={{ borderLeft: '5px solid var(--primary)', padding: '15px 25px', display: 'flex', gap: 10 }}><CheckCircle size={18} /> {toastMsg}</div></div>}

      <div className="wrapper">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div style={{ fontWeight: 900, fontSize: '1.5rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}><Zap /> FinPro</div>
          <nav style={{ flex: 1 }}>
            <div className={`nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}><LayoutDashboard size={20} /> Dashboard</div>
            <div className={`nav-item ${activeTab === 'extract' ? 'active' : ''}`} onClick={() => setActiveTab('extract')}><List size={20} /> Transações</div>
            <div className={`nav-item ${activeTab === 'charts' ? 'active' : ''}`} onClick={() => setActiveTab('charts')}><PieChart size={20} /> Relatórios</div>
            <div className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => { setActiveTab('profile'); setProfileForm({ name: user.name, goal: user.goal, pass: '' }); }}><User size={20} /> Perfil</div>
          </nav>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            <div className="nav-item" onClick={() => setUser({ ...user, dark: !user.dark })}><Moon size={20} /> Modo Escuro</div>
            <div className="nav-item" onClick={() => { setUser({ ...user, logged: false }); setAuthPass(''); }} style={{ color: 'var(--danger)' }}><LogOut size={20} /> Sair</div>
          </div>
        </aside>

        {/* MOBILE NAV */}
        <nav className="mobile-nav">
          <div className={`nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}><Home /></div>
          <div className={`nav-item ${activeTab === 'extract' ? 'active' : ''}`} onClick={() => setActiveTab('extract')}><List /></div>
          <button onClick={() => setShowModal(true)} style={{ background: 'var(--primary)', color: 'white', border: 'none', width: 50, height: 50, borderRadius: '50%', transform: 'translateY(-15px)', boxShadow: '0 8px 15px rgba(79,70,229,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus /></button>
          <div className={`nav-item ${activeTab === 'charts' ? 'active' : ''}`} onClick={() => setActiveTab('charts')}><PieChart /></div>
          <div className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}><Settings /></div>
        </nav>

        {/* MAIN */}
        <main className="main-content">
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
            <div>
              <h1 style={{ fontSize: '1.6rem' }}>Olá, {user.name}</h1>
              <div style={{display:'flex', gap:10, alignItems:'center'}}>
                <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>{new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</p>
                {loading && <RefreshCw size={14} className="animate-spin" />}
              </div>
            </div>
            <button className="btn btn-primary desktop-only" style={{ display: window.innerWidth > 1024 ? 'flex' : 'none' }} onClick={() => setShowModal(true)}><Plus size={18} /> Novo Registro</button>
          </header>

          {activeTab === 'home' && (
            <section>
              <div className="card hero-card">
                <small style={{ opacity: 0.8 }}>SALDO EM NUVEM</small>
                <h2 style={{ fontSize: '2.5rem', margin: '8px 0' }}>{fmt(bal)}</h2>
                <div style={{ display: 'flex', gap: 20, fontSize: '0.9rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><TrendingUp size={14} /> {fmt(tin)}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><TrendingDown size={14} /> {fmt(tout)}</span>
                </div>
              </div>
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: 10 }}><span>Meta Mensal</span><span>{Math.round(perc)}%</span></div>
                <div className="progress-container"><div className="progress-bar" style={{ width: `${perc}%`, background: perc > 90 ? 'var(--danger)' : 'var(--primary)' }}></div></div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>Gasto: {fmt(tout)} | Limite: {fmt(user.goal)}</p>
              </div>
              <h3>Atividade Recente</h3>
              <div style={{ marginTop: 15 }}>
                {transactions.length === 0 && !loading && <p style={{color:'var(--text-sub)', textAlign:'center', marginTop:20}}>Nenhuma transação encontrada.</p>}
                {transactions.slice(0, 5).map(t => <TransactionItem key={t.id} t={t} fmt={fmt} onDelete={deleteEntry} onEdit={handleEdit} />)}
              </div>
            </section>
          )}

          {activeTab === 'extract' && (
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3>Todas as Transações</h3>
                <button className="btn" onClick={exportPDF} style={{ background: 'var(--card)', border: '1px solid var(--border)' }}><FileText size={18} /> PDF</button>
              </div>
              <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <div>
                {filteredTransactions.map(t => <TransactionItem key={t.id} t={t} fmt={fmt} onDelete={deleteEntry} onEdit={handleEdit} />)}
              </div>
            </section>
          )}

          {activeTab === 'charts' && (
            <section>
              <h3>Análise</h3>
              <div className="card" style={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 20 }}>
                {chartData.datasets[0].data.length > 0 ? <Doughnut data={chartData} options={{ maintainAspectRatio: false }} /> : <p>Sem dados suficientes.</p>}
              </div>
            </section>
          )}

          {activeTab === 'profile' && (
            <section>
              <div className="card">
                <h3>Configurações (Local)</h3>
                <div style={{ marginTop: 20 }}>
                  <label>Nome</label>
                  <input type="text" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} />
                  <label>Meta Mensal</label>
                  <input type="number" value={profileForm.goal} onChange={e => setProfileForm({...profileForm, goal: e.target.value})} />
                  <label>Alterar Senha</label>
                  <input type="password" placeholder="Nova senha" value={profileForm.pass} onChange={e => setProfileForm({...profileForm, pass: e.target.value})} />
                  <button className="btn btn-primary" style={{ width: '100%' }} onClick={saveProfile}>Salvar Alterações</button>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: 20 }}>{editingId ? 'Editar' : 'Novo'}</h3>
            <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
              <option value="in">Entrada (+)</option>
              <option value="out">Saída (-)</option>
            </select>
            <input type="text" placeholder="Descrição" value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} />
            <input type="number" placeholder="Valor" value={form.val} onChange={e => setForm({...form, val: e.target.value})} />
            <select value={form.cat} onChange={e => setForm({...form, cat: e.target.value})}>
              <option value="Salário">💳 Salário</option>
              <option value="Alimentação">🍴 Alimentação</option>
              <option value="Transporte">🚗 Transporte</option>
              <option value="Saúde">🏥 Saúde</option>
              <option value="Lazer">🍿 Lazer</option>
              <option value="Outros">📦 Outros</option>
            </select>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={saveTransaction} disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</button>
              <button className="btn" style={{ flex: 1, background: 'var(--bg)', justifyContent: 'center' }} onClick={closeModal}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* PDF TEMPLATE */}
      <div id="pdf-template" ref={pdfRef} style={{ display: 'none', padding: 40, color: 'black', background: 'white' }}>
        <h1 style={{ color: '#4f46e5' }}>FinPro Elite - Relatório</h1>
        <p>Usuário: {user.name} | Data: {new Date().toLocaleDateString()}</p>
        <hr style={{ margin: '20px 0' }} />
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead><tr style={{ borderBottom: '2px solid #333' }}><th>Data</th><th>Descrição</th><th>Valor</th></tr></thead>
          <tbody>
            {transactions.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid #ccc' }}>
                <td style={{ padding: 8 }}>{t.date}</td><td>{t.desc}</td>
                <td style={{ color: t.val < 0 ? 'red' : 'green' }}>{t.val.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TransactionItem({ t, fmt, onDelete, onEdit }) {
  const isOut = t.val < 0;
  return (
    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 15, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ color: 'var(--primary)' }}><Zap size={18} /></div>
        <div><b>{t.desc}</b><br /><small style={{ color: 'var(--text-sub)' }}>{t.cat} • {t.date}</small></div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <b style={{ color: isOut ? 'var(--text-main)' : 'var(--success)', marginRight: 5 }}>{fmt(t.val)}</b>
        <button onClick={() => onEdit(t)} style={{ border: 'none', background: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: 5 }}><Edit size={18} /></button>
        <button onClick={() => onDelete(t.id)} style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 5 }}><Trash2 size={18} /></button>
      </div>
    </div>
  );
}