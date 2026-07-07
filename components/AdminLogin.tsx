'use client';

import { useState } from 'react';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || '로그인에 실패했습니다.');
      setLoading(false);
      return;
    }

    window.location.reload();
  }

  return (
    <section className="admin-login-card">
      <div>
        <p className="admin-login-eyebrow">SECURE AREA</p>
        <h2>관리자 로그인</h2>
        <p>상담 고객 정보 보호를 위해 관리자 비밀번호가 필요합니다.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <label>
          <span>관리자 비밀번호</span>
          <input
            type="password"
            value={password}
            placeholder="비밀번호 입력"
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {message && <p className="admin-login-message">{message}</p>}

        <button type="submit" disabled={loading}>
          {loading ? '확인 중...' : '로그인'}
        </button>
      </form>

      <small>
        Vercel 환경변수 <b>RECHAIR_ADMIN_PASSWORD</b> 설정 후 사용하세요.
      </small>
    </section>
  );
}
