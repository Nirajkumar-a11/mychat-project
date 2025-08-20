import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ⚡ Set your username here (You = yourself, Friend = your friend)
// Change only this line for identity
const CURRENT_USER = "You"; // or "Friend"

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [friendStatus, setFriendStatus] = useState("offline");
  const [friendLastSeen, setFriendLastSeen] = useState(null);

  // Load old messages + subscribe realtime
  useEffect(() => {
    fetchMessages();
    subscribeMessages();
    updatePresence("online");

    const interval = setInterval(() => {
      updatePresence("online");
    }, 15000); // ping every 15 sec like WhatsApp
    return () => {
      clearInterval(interval);
      updatePresence("offline");
    };
  }, []);

  // Fetch old messages
  async function fetchMessages() {
    let { data } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true });
    setMessages(data || []);
  }

  // Subscribe for new messages
  function subscribeMessages() {
    supabase
      .channel("chat-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    supabase
      .channel("chat-presence")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "presence" },
        handlePresence
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "presence" },
        handlePresence
      )
      .subscribe();
  }

  // Handle presence updates
  function handlePresence(payload) {
    const p = payload.new;
    if (p.user !== CURRENT_USER) {
      setFriendStatus(p.status);
      setFriendLastSeen(p.last_seen);
    }
  }

  // Update presence
  async function updatePresence(status) {
    await supabase.from("presence").upsert({
      user: CURRENT_USER,
      status,
      last_seen: new Date().toISOString(),
    });
  }

  // Send message
  async function sendMessage() {
    if (newMessage.trim() === "") return;
    await supabase.from("messages").insert({
      text: newMessage,
      sender: CURRENT_USER,
    });
    setNewMessage("");
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <strong>Friend</strong>
        <div style={{ fontSize: "12px", color: "#ddd" }}>
          {friendStatus === "online"
            ? "Online"
            : friendLastSeen
            ? `Last seen ${new Date(friendLastSeen).toLocaleTimeString()}`
            : "Offline"}
        </div>
      </div>

      <div style={styles.chat}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              ...styles.message,
              ...(msg.sender === CURRENT_USER
                ? styles.myMessage
                : styles.friendMessage),
            }}
          >
            <div style={{ fontSize: "12px", opacity: 0.7 }}>
              {msg.sender}
            </div>
            <div>{msg.text}</div>
          </div>
        ))}
      </div>

      <div style={styles.inputBox}>
        <input
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          style={styles.input}
        />
        <button onClick={sendMessage} style={styles.sendBtn}>
          Send
        </button>
      </div>
    </div>
  );
}

// WhatsApp-like CSS-in-JS
const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    maxWidth: "600px",
    margin: "0 auto",
    background: "#0f172a",
    color: "white",
    fontFamily: "Arial, sans-serif",
  },
  header: {
    padding: "12px",
    borderBottom: "1px solid #334155",
    background: "#1e293b",
  },
  chat: {
    flex: 1,
    padding: "10px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  message: {
    padding: "10px",
    borderRadius: "8px",
    maxWidth: "70%",
  },
  myMessage: {
    alignSelf: "flex-end",
    background: "#3b82f6",
    color: "white",
  },
  friendMessage: {
    alignSelf: "flex-start",
    background: "#334155",
    color: "white",
  },
  inputBox: {
    display: "flex",
    gap: "8px",
    padding: "10px",
    borderTop: "1px solid #334155",
  },
  input: {
    flex: 1,
    padding: "10px",
    borderRadius: "6px",
    border: "none",
  },
  sendBtn: {
    padding: "10px 16px",
    background: "#3b82f6",
    border: "none",
    borderRadius: "6px",
    color: "white",
    cursor: "pointer",
  },
};
