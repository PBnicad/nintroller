import React, { useEffect, useState } from 'react';

interface Status {
  connected: boolean;
  port: string | null;
  mode: string;
  firmware: string;
  btConnected: boolean;
  sequenceSize: number;
  sequenceCapacity: number;
}

export default function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [port, setPort] = useState('');
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ connected: false, port: null, mode: 'immediate', firmware: '?', btConnected: false, sequenceSize: 0, sequenceCapacity: 1024 }));
  }, []);

  return (
    <div style={{ fontFamily: 'monospace', padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <h1>Nintroller</h1>

      <section style={sectionStyle}>
        <h2>Connection</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="COM3"
            style={inputStyle}
          />
          <button style={btnStyle}>Connect</button>
          <button style={btnStyle}>Disconnect</button>
        </div>
        {status && (
          <pre style={{ marginTop: 12, padding: 12, background: '#111', color: '#0f0', borderRadius: 4 }}>
            {JSON.stringify(status, null, 2)}
          </pre>
        )}
      </section>

      <section style={sectionStyle}>
        <h2>Quick Controls</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
          {['A', 'B', 'X', 'Y', 'L', 'R', 'ZL', 'ZR', 'HOME', 'CAPTURE', 'UP', 'DOWN', 'LEFT', 'RIGHT'].map((btn) => (
            <button key={btn} style={btnStyle}>{btn}</button>
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>Sequence</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnStyle}>Begin</button>
          <button style={btnStyle}>Play</button>
          <button style={btnStyle}>Clear</button>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>Log</h2>
        <pre style={{ background: '#111', color: '#0f0', padding: 12, borderRadius: 4, maxHeight: 200, overflow: 'auto' }}>
          {log.join('\n') || 'No log entries'}
        </pre>
      </section>
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  marginBottom: 24,
  padding: 16,
  border: '1px solid #333',
  borderRadius: 8,
  background: '#1a1a2e',
  color: '#e0e0e0',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  background: '#0d0d1a',
  color: '#e0e0e0',
  border: '1px solid #444',
  borderRadius: 4,
  fontFamily: 'monospace',
};

const btnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: '#2a2a4a',
  color: '#e0e0e0',
  border: '1px solid #555',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'monospace',
};
