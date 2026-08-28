// AhMengChat — follow-up chat shown after a confident ID (Requirement 11).
// POSTs { mode: "chat", question, context } to the same /identify route.

import { useState } from 'react';
import { askAhMeng } from '../api/client.js';

export default function AhMengChat({ species, facts, mockId }) {
  const [messages, setMessages] = useState([]); // { role: 'user'|'bot', text }
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const question = input.trim();
    if (!question || busy) return;

    setMessages((m) => [...m, { role: 'user', text: question }]);
    setInput('');
    setBusy(true);

    const res = await askAhMeng({
      question,
      context: { species, facts },
      mockId,
    });

    setMessages((m) => [...m, { role: 'bot', text: res.answer }]);
    setBusy(false);
  }

  return (
    <section className="section">
      <h3>Ask Ah Meng</h3>

      {messages.length > 0 && (
        <div className="chat-log">
          {messages.map((msg, i) => (
            <div className={`chat-bubble ${msg.role}`} key={i}>
              {msg.text}
            </div>
          ))}
          {busy && <div className="chat-bubble bot">Ah Meng is thinking…</div>}
        </div>
      )}

      <form className="chat-form" onSubmit={onSubmit}>
        <input
          type="text"
          placeholder={`Ask about the ${species}…`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          aria-label="Ask Ah Meng a question"
        />
        <button className="btn" type="submit" disabled={busy || !input.trim()}>
          Ask
        </button>
      </form>
    </section>
  );
}
