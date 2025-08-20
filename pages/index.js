import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [status, setStatus] = useState('offline');
  const [lastSeen, setLastSeen] = useState(null);

  // Load messages on mount
  useEffect(() => {
    fetchMessages();

    // Realtime listener
    const channel = supabase
      .channel('chat-room')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        setMessages(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch messages from Supabase
  async function fetchMessages() {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error) {
      setMessages(data);
    }
  }

  // Send message
  async function sendMessage() {
    if (newMessage.trim() === '') return;

    await supabase.from('messages').insert([
      { text: newMessage, sender: 'me' }
    ]);

    setNewMessage('');
  }

  // Presence tracking (online/offline + last seen)
  useEffect(() => {
    const updateStatus = async (state) => {
      const now = new Date().toISOString();
      if (state === 'online') {
        await supabase.from('presence').upsert([{ user: 'me', status: 'online', last_seen: now }]);
      } else {
        await supabase.from('presence').upsert([{ user: 'me', status: 'offline', last_seen: now }]);
      }
    };

    // Mark online
    updateStatus('online');

    // On unload (offline)
    const handleUnload = () => {
      updateStatus('offline');
    };
    window.addEventListener('beforeunload', handleUnload);

    // Poll friend's status every 5s
    const interval = setInterval(async () => {
      const { data } = await supabase.from('presence').select('*').eq('user', 'friend').single();
      if (data) {
        setStatus(data.status);
        setLastSeen(data.last_seen);
      }
    }, 5000);

    return () => {
      handleUnload();
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  return (
    <div className="chat-box">
      <h2>My Chat App</h2>
      <p>
        Friend is {status} {status === 'offline' && lastSeen ? `(last seen ${new Date(lastSeen).toLocaleTimeString()})` : ''}
      </p>

      <div>
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.sender === 'me' ? 'self' : 'friend'}`}>
            {msg.text}
          </div>
        ))}
      </div>

      <input
        type="text"
        value={newMessage}
        onChange={e => setNewMessage(e.target.value)}
        placeholder="Type a message..."
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}
