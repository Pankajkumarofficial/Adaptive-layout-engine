import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type Account, type StoredSpec } from '../lib/api';
import { usePlayground } from '../lib/store';

/**
 * Saving, opening and sharing. Kept deliberately small: the engine is the
 * subject of this project, and an account here exists only so a layout can
 * outlive the tab it was made in.
 */
export function Library() {
  const spec = usePlayground((s) => s.spec);
  const setSpec = usePlayground((s) => s.setSpec);

  const [account, setAccount] = useState<Account | null>(null);
  const [checked, setChecked] = useState(false);
  const [items, setItems] = useState<StoredSpec[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setItems((await api.listSpecs()).items);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const me = await api.me();
        setAccount(me);
        await refresh();
      } catch {
        setAccount(null);
      } finally {
        setChecked(true);
      }
    })();
  }, [refresh]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : `${label} did not work`);
    } finally {
      setBusy(false);
    }
  };

  if (!checked) {
    return <p className="p-4 text-tiny text-ink-3">Checking your session&hellip;</p>;
  }

  if (account === null) {
    return (
      <SignIn
        onSignedIn={async (a) => {
          setAccount(a);
          await refresh();
        }}
      />
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="flex items-baseline gap-2 border-b border-rule px-4 py-2">
        <span className="truncate text-tiny text-ink-2">{account.email}</span>
        <button
          type="button"
          className="ml-auto text-tiny text-ink-3 hover:text-ink"
          onClick={() =>
            void run('Signing out', async () => {
              await api.logout();
              setAccount(null);
              setItems([]);
              setOpenId(null);
              setShareUrl(null);
            })
          }
        >
          Sign out
        </button>
      </div>

      <div className="flex gap-2 border-b border-rule px-4 py-2">
        <button
          type="button"
          disabled={busy}
          className="bg-ink px-2 py-1 text-tiny text-on-accent disabled:opacity-50"
          onClick={() =>
            void run('Saving', async () => {
              const saved =
                openId === null ? await api.createSpec(spec) : await api.updateSpec(openId, spec);
              setOpenId(saved.id);
              await refresh();
              setMessage(`Saved as “${saved.name}”.`);
            })
          }
        >
          {openId === null ? 'Save to library' : 'Save changes'}
        </button>
        <button
          type="button"
          disabled={busy || openId === null}
          className="border border-rule-2 px-2 py-1 text-tiny text-ink-2 hover:border-ink hover:text-ink disabled:opacity-40"
          onClick={() =>
            void run('Sharing', async () => {
              if (openId === null) return;
              const { slug } = await api.share(openId);
              const url = `${window.location.origin}/s/${slug}`;
              setShareUrl(url);
              // Clipboard access can be refused — a browser setting, a missing
              // user gesture, an insecure context. Say which happened instead
              // of claiming success, because the link itself is shown either
              // way and the reader needs to know whether to select it by hand.
              try {
                await navigator.clipboard.writeText(url);
                setMessage('Link copied to your clipboard.');
              } catch {
                setMessage('Could not reach the clipboard — copy the link below.');
              }
            })
          }
        >
          Share
        </button>
      </div>

      {message !== null && <p className="px-4 pt-2 text-tiny text-guide">{message}</p>}

      {shareUrl !== null && (
        <div className="mx-4 mb-2 mt-1 border border-rule bg-card p-2">
          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className="block break-all text-tiny text-guide underline underline-offset-2 hover:text-ink"
          >
            {shareUrl}
          </a>
          <div className="mt-1.5 flex items-center gap-3">
            <button
              type="button"
              className="text-micro text-ink-2 hover:text-ink"
              onClick={() => {
                void navigator.clipboard
                  .writeText(shareUrl)
                  .then(() => setMessage('Link copied to your clipboard.'))
                  .catch(() =>
                    setMessage('Could not reach the clipboard — select the link above.'),
                  );
              }}
            >
              Copy link
            </button>
            <span className="text-micro text-ink-3">Anyone with this link can view it.</span>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="px-4 py-3 text-tiny leading-snug text-ink-3">
          Nothing saved yet. Save this spec and it will be here on any machine you sign in from.
        </p>
      ) : (
        <ul>
          {items.map((item) => (
            <li
              key={item.id}
              className={`flex items-center gap-2 border-b border-rule/60 px-4 py-2 ${
                openId === item.id ? 'bg-card' : ''
              }`}
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-tiny font-medium hover:text-guide"
                onClick={() => {
                  setSpec(item.spec);
                  setOpenId(item.id);
                  setShareUrl(null);
                }}
              >
                {item.name}
              </button>
              <button
                type="button"
                className="text-micro text-ink-3 hover:text-reg"
                onClick={() =>
                  void run('Deleting', async () => {
                    await api.deleteSpec(item.id);
                    if (openId === item.id) setOpenId(null);
                    await refresh();
                  })
                }
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SignIn({ onSignedIn }: { onSignedIn: (a: Account) => Promise<void> }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        void (mode === 'login' ? api.login(email, password) : api.register(email, password))
          .then(onSignedIn)
          .catch((err: unknown) =>
            setError(err instanceof ApiError ? err.message : 'That did not work'),
          )
          .finally(() => setBusy(false));
      }}
    >
      <p className="mb-3 text-tiny leading-snug text-ink-2">
        The playground works without an account. Sign in to keep specs and share a link to them.
      </p>
      <label className="mb-2 block">
        <span className="mb-1 block text-micro text-ink-3">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-rule bg-card px-2 py-1 text-tiny focus:border-guide focus:outline-none"
        />
      </label>
      <label className="mb-3 block">
        <span className="mb-1 block text-micro text-ink-3">
          Password{' '}
          {mode === 'register' && <span className="text-ink-3">&mdash; 8 or more characters</span>}
        </span>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-rule bg-card px-2 py-1 text-tiny focus:border-guide focus:outline-none"
        />
      </label>

      {error !== null && <p className="mb-2 text-tiny text-reg">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="bg-ink px-3 py-1 text-tiny text-on-accent disabled:opacity-50"
        >
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <button
          type="button"
          className="text-tiny text-ink-3 hover:text-ink"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
        >
          {mode === 'login' ? 'Create an account' : 'I already have one'}
        </button>
      </div>
    </form>
  );
}
