import { createContext, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  useBlockProfile, useBuyDemoCredits, useCreateRealtimeTicket, useDiscoverProfiles,
  useGetMyProfile, useGetWallet, useListConversations, useListMessages, useReportProfile,
  useSaveMyProfile, useSendMessage, useStartConversation, useStartDirectCall,
  getDiscoverProfilesQueryKey, getGetMyProfileQueryKey, getGetWalletQueryKey,
  getListConversationsQueryKey, getListMessagesQueryKey,
} from '@workspace/api-client-react';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import {
  ArrowLeft, ArrowRight, AudioLines, BadgeCheck, Check, ChevronDown, CircleHelp,
  Compass, CreditCard, Heart, LockKeyhole, LogOut, MapPin, MessageCircle, Mic,
  MicOff, Moon, MoreHorizontal, PhoneOff, Plus, Search, Send,
  Settings2, Shield, ShieldAlert, Sparkles, Sun, Video, VideoOff, Wallet as WalletIcon,
  X,
} from 'lucide-react';
import './index.css';
import './suhana.css';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const stripBase = (path: string) => basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;

const appearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#315b4b',
    colorForeground: '#273c34',
    colorMutedForeground: '#687a70',
    colorDanger: '#b64c3f',
    colorBackground: '#fffaf2',
    colorInput: '#fffdf9',
    colorInputForeground: '#273c34',
    colorNeutral: '#dcd8cc',
    fontFamily: 'DM Sans',
    borderRadius: '1rem',
  },
  elements: {
    rootBox: 'suhana-clerk-root w-full flex justify-center',
    cardBox: 'suhana-clerk-card bg-[#fffaf2] rounded-[28px] w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-display text-[#273c34] font-semibold',
    headerSubtitle: 'text-[#687a70]',
    socialButtonsBlockButtonText: 'text-[#273c34] font-semibold',
    formFieldLabel: 'text-[#273c34] font-semibold',
    footerActionLink: 'text-[#315b4b] font-bold',
    footerActionText: 'text-[#687a70]',
    dividerText: 'text-[#687a70]',
    identityPreviewEditButton: 'text-[#315b4b]',
    formFieldSuccessText: 'text-[#315b4b]',
    alertText: 'text-[#273c34]',
    logoBox: 'mb-3',
    logoImage: 'rounded-full',
    socialButtonsBlockButton: 'border-[#dcd8cc] rounded-xl',
    formButtonPrimary: 'bg-[#315b4b] hover:bg-[#244738] rounded-xl shadow-none',
    formFieldInput: 'bg-[#fffdf9] border-[#dcd8cc] rounded-xl text-[#273c34]',
    footerAction: 'text-[#687a70]',
    dividerLine: 'bg-[#e7e1d5]',
    alert: 'rounded-xl',
    otpCodeFieldInput: 'rounded-xl',
    formFieldRow: 'mb-4',
    main: 'gap-4',
  },
};

function Brand({ inverse = false }: { inverse?: boolean }) {
  return <Link href="/" className={`brand ${inverse ? 'brand-inverse' : ''}`} data-testid="link-brand">
    <span className="brand-mark"><Heart size={17} strokeWidth={2.5} /></span><span>suhana</span>
  </Link>;
}

function ThemeToggle() {
  const { dark, toggle } = useThemeState();
  return <button className="icon-button" type="button" onClick={toggle} aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`} data-testid="button-theme">
    {dark ? <Sun size={18} /> : <Moon size={18} />}
  </button>;
}

function ThemeRoot({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() => localStorage.getItem('suhana-theme') === 'dark');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('suhana-theme', dark ? 'dark' : 'light');
  }, [dark]);
  return <ThemeContextRoot.Provider value={{ dark, setDark, toggle: () => setDark(value => !value) }}>{children}</ThemeContextRoot.Provider>;
}
const ThemeContextRoot = createContext<{ dark: boolean; setDark: (value: boolean) => void; toggle: () => void }>({ dark: false, setDark: () => undefined, toggle: () => undefined });
function useThemeState() {
  const { dark, toggle } = useContext(ThemeContextRoot);
  return { dark, toggle };
}

function Topbar({ simple = false }: { simple?: boolean }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [menuOpen, setMenuOpen] = useState(false);
  return <header className="topbar">
    <div className="topbar-inner">
      <Brand />
      {!simple && user && <nav className="top-nav" aria-label="Main navigation">
        <Link href="/discover" className="nav-link" data-testid="link-discover"><Compass size={16} /> Discover</Link>
        <Link href="/messages" className="nav-link" data-testid="link-messages"><MessageCircle size={16} /> Messages</Link>
        <Link href="/wallet" className="nav-link" data-testid="link-wallet"><WalletIcon size={16} /> Wallet</Link>
      </nav>}
      <div className="top-actions">
        {!simple && user && <ThemeToggle />}
        {user && <div className="user-menu">
          <button type="button" className="user-chip" onClick={() => setMenuOpen(open => !open)} data-testid="button-account-menu">
            <span className="user-avatar">{(user.firstName || user.primaryEmailAddress?.emailAddress || 'S').slice(0, 1).toUpperCase()}</span>
            <span className="user-name">{user.firstName || 'Your account'}</span><ChevronDown size={14} />
          </button>
          {menuOpen && <div className="menu-popover">
            <Link href="/profile" className="menu-item" onClick={() => setMenuOpen(false)}>Edit profile</Link>
            <button type="button" className="menu-item" onClick={() => signOut({ redirectUrl: basePath || '/' })}><LogOut size={15} /> Sign out</button>
          </div>}
        </div>}
        {!user && <><ThemeToggle /><Link href="/sign-in" className="text-link desktop-signin" data-testid="link-sign-in">Sign in</Link><Link href="/sign-up" className="button button-small" data-testid="link-sign-up">Join Suhana <ArrowRight size={15} /></Link></>}
      </div>
    </div>
  </header>;
}

function Landing() {
  return <div className="landing">
    <Topbar />
    <main>
      <section className="hero section-wrap">
        <div className="hero-copy page-enter">
          <div className="eyebrow"><span className="eyebrow-line" /> A softer way to meet</div>
          <h1>Good things<br />begin with <em>hello.</em></h1>
          <p className="hero-text">Meet people who feel like your kind of people. Thoughtful profiles, real conversation, and a little more heart in every hello.</p>
          <div className="hero-actions">
            <Link href="/sign-up" className="button button-large" data-testid="button-hero-join">Find your people <ArrowRight size={18} /></Link>
            <Link href="/sign-in" className="quiet-link" data-testid="button-hero-sign-in">Already here? Sign in</Link>
          </div>
          <div className="trust-note"><span className="trust-icon"><Shield size={16} /></span><span>Kindness first. Your pace, always.</span></div>
        </div>
        <div className="hero-art" aria-label="A glimpse of Suhana">
          <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
          <div className="portrait portrait-main">
            <div className="portrait-sun" />
            <div className="portrait-head"><div className="portrait-hair" /><div className="portrait-face"><span className="eye eye-left" /><span className="eye eye-right" /><span className="portrait-smile" /></div></div>
            <div className="portrait-body"><span className="portrait-neck" /><span className="portrait-shirt" /></div>
          </div>
          <div className="floating-note note-one"><span className="note-dot" /><span><b>“The best chats</b><br />start unexpectedly.”</span></div>
          <div className="floating-note note-two"><span className="mini-avatar">M</span><span><b>Mira, 28</b><small>Lisbon · 2 km away</small></span><Heart size={16} className="note-heart" /></div>
          <div className="art-caption"><span>01 / 03</span><span>Make room for a new story</span></div>
        </div>
      </section>
      <section className="promise-strip">
        <div className="section-wrap promise-inner"><span>For the curious</span><span className="promise-dot" /><span>For the almost-ready</span><span className="promise-dot" /><span>For the real conversation</span></div>
      </section>
      <section className="how section-wrap">
        <div className="section-kicker">A lovely little beginning</div>
        <div className="how-heading"><h2>Less swiping.<br /><em>More meeting.</em></h2><p>We made the space we wished existed: a little more intentional, a lot more human.</p></div>
        <div className="how-grid">
          <article className="how-item"><span className="step-number">01</span><div className="how-icon"><Sparkles size={21} /></div><h3>Show up as you</h3><p>Build a profile with the details that make you, unmistakably you.</p></article>
          <article className="how-item"><span className="step-number">02</span><div className="how-icon"><Compass size={21} /></div><h3>Find your familiar</h3><p>Meet people nearby who share your interests and open-hearted energy.</p></article>
          <article className="how-item"><span className="step-number">03</span><div className="how-icon"><AudioLines size={21} /></div><h3>Let the moment happen</h3><p>Take it from a good message to a face-to-face hello, when you’re ready.</p></article>
        </div>
      </section>
      <section className="safety-band"><div className="section-wrap safety-inner"><div className="safety-seal"><Shield size={26} /></div><div><div className="section-kicker">A little peace of mind</div><h2>Good connections<br /><em>need good boundaries.</em></h2></div><p>Safety is part of the experience, not an afterthought. You’re in control of what you share, who you speak to, and when you leave a conversation.</p><Link href="/sign-up" className="quiet-link">Meet at your own pace <ArrowRight size={16} /></Link></div></section>
      <section className="last-call section-wrap"><span className="section-kicker">Your next hello is out there</span><h2>Come as you are.<br /><em>Leave room for wonder.</em></h2><Link href="/sign-up" className="button button-large">Start meeting <ArrowRight size={18} /></Link></section>
    </main>
    <footer className="footer"><div className="section-wrap footer-inner"><Brand /><span>Made for the moments that matter.</span><span>© 2025 Suhana</span></div></footer>
  </div>;
}

function Protected({ children }: { children: ReactNode }) {
  return <><Show when="signed-in">{children}</Show><Show when="signed-out"><Redirect to="/" /></Show></>;
}

function Shell({ children, active = '' }: { children: ReactNode; active?: string }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { dark, toggle } = useThemeState();
  const [mobileMenu, setMobileMenu] = useState(false);
  const nav = [
    { href: '/discover', label: 'Discover', icon: Compass },
    { href: '/messages', label: 'Messages', icon: MessageCircle },
    { href: '/wallet', label: 'Wallet', icon: WalletIcon },
    { href: '/profile', label: 'My profile', icon: Settings2 },
  ];
  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand"><Brand /><button className="icon-button sidebar-close" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X size={18} /></button></div>
      <div className="side-label">YOUR SPACE</div>
      <nav className="side-nav">{nav.map(item => {
        const Icon = item.icon;
        return <Link key={item.href} href={item.href} onClick={() => setMobileMenu(false)} className={`side-link ${active === item.href ? 'side-active' : ''}`} data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}><Icon size={18} /><span>{item.label}</span>{item.href === '/messages' && <span className="side-unread" />}</Link>;
      })}</nav>
      <div className="sidebar-bottom"><div className="side-promise"><Shield size={17} /><span>Your comfort<br />comes first.</span></div>
        <button type="button" className="side-link" onClick={toggle} data-testid="button-sidebar-theme">{dark ? <Sun size={18} /> : <Moon size={18} />}<span>{dark ? 'Light appearance' : 'Dark appearance'}</span></button>
        <button type="button" className="side-link" onClick={() => signOut({ redirectUrl: basePath || '/' })}><LogOut size={18} /><span>Sign out</span></button>
      </div>
      <div className="sidebar-user"><span className="user-avatar">{(user?.firstName || 'S').slice(0, 1).toUpperCase()}</span><span><b>{user?.firstName || 'Suhana member'}</b><small>Here for a good hello</small></span><MoreHorizontal size={18} /></div>
    </aside>
    {mobileMenu && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileMenu(false)} />}
    <div className="main-column">
      <header className="app-topbar"><button className="icon-button mobile-menu-toggle" onClick={() => setMobileMenu(true)} aria-label="Open navigation"><MoreHorizontal size={20} /></button><Brand /><div className="app-top-right"><span className="safe-pill"><span /> A kinder corner of the internet</span><Link href="/profile" className="user-avatar top-avatar" aria-label="Open your profile">{(user?.firstName || 'S').slice(0, 1).toUpperCase()}</Link></div></header>
      <main className="page-content page-enter">{children}</main>
      <div className="mobile-nav">{nav.map(item => {
        const Icon = item.icon;
        return <Link key={item.href} href={item.href} className={`mobile-nav-link ${active === item.href ? 'mobile-nav-active' : ''}`}><Icon size={19} /><span>{item.label}</span></Link>;
      })}</div>
    </div>
  </div>;
}

function ProfileImage({ src, name, className = '' }: { src?: string | null; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (src && !failed) return <img className={className} src={src} alt={name} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
  return <div className={`image-fallback ${className}`}>{name.slice(0, 1).toUpperCase()}</div>;
}

function Discovery() {
  const queryClient = useQueryClient();
  const ownProfile = useGetMyProfile();
  const [gender, setGender] = useState('');
  const [location, setLocation] = useState('');
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const params = useMemo(() => ({
    ...(gender ? { gender } : {}),
    ...(location.trim() ? { location: location.trim() } : {}),
    ...(ageMin ? { ageMin: Number(ageMin) } : {}),
    ...(ageMax ? { ageMax: Number(ageMax) } : {}),
  }), [gender, location, ageMin, ageMax]);
  const { data, isLoading, isError, refetch } = useDiscoverProfiles(params, { query: { queryKey: getDiscoverProfilesQueryKey(params) } });
  const start = useStartConversation();
  const block = useBlockProfile();
  const report = useReportProfile();
  const [, setRoute] = useLocation();
  const people = data?.profiles || [];
  const connect = (profileId: string) => start.mutate({ data: { peerId: profileId } }, { onSuccess: conversation => {
    queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    setRoute(`/messages/${conversation.id}`);
  } });
  const flag = (id: string) => {
    const action = window.prompt('Choose an action: type “report” or “block”.');
    if (action?.toLowerCase() === 'block') block.mutate({ profileId: id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getDiscoverProfilesQueryKey(params) }) });
    if (action?.toLowerCase() === 'report') {
      const reason = window.prompt('What would you like us to know? (at least 3 characters)');
      if (reason && reason.trim().length >= 3) report.mutate({ profileId: id, data: { reason: reason.trim() } });
    }
  };
  if (!ownProfile.isLoading && !ownProfile.isError && !ownProfile.data?.profile) {
    return <Redirect to="/profile" />;
  }
  return <Shell active="/discover"><div className="page-heading discovery-heading"><div><div className="section-kicker">A good place to begin</div><h1>People worth <em>meeting.</em></h1><p>Curious minds, kind hearts, and a whole lot of stories.</p></div><button className="filter-button" onClick={() => setFiltersOpen(!filtersOpen)}><Settings2 size={17} /> Filters <ChevronDown size={15} /></button></div>
    {filtersOpen && <div className="filter-panel">
      <label>Looking for<select value={gender} onChange={e => setGender(e.target.value)}><option value="">Everyone</option><option value="Woman">Women</option><option value="Man">Men</option><option value="Non-binary">Non-binary people</option></select></label>
      <label>Age from<input type="number" min="18" placeholder="18" value={ageMin} onChange={e => setAgeMin(e.target.value)} /></label>
      <label>Age to<input type="number" min="18" placeholder="Any" value={ageMax} onChange={e => setAgeMax(e.target.value)} /></label>
      <label>Near<input type="search" placeholder="City or neighborhood" value={location} onChange={e => setLocation(e.target.value)} /></label>
    </div>}
    {isLoading ? <div className="profile-grid">{[0, 1, 2, 3].map(key => <div className="profile-skeleton" key={key}><div /><span /><span /></div>)}</div>
      : isError ? <div className="state-card"><div className="state-symbol"><CircleHelp size={22} /></div><h2>We lost the thread for a moment.</h2><p>Your people are still here. Try loading discovery again.</p><button className="button button-small" onClick={() => refetch()}>Try again <ArrowRight size={15} /></button></div>
      : people.length === 0 ? <div className="state-card"><div className="state-symbol"><Search size={22} /></div><h2>No introductions just yet.</h2><p>Try widening your filters, or come back soon. Good things take their own time.</p><button className="button button-small" onClick={() => { setGender(''); setAgeMin(''); setAgeMax(''); setLocation(''); }}>Clear filters <X size={14} /></button></div>
       : <div className="profile-grid">{people.map(profile => <article className="profile-card" key={profile.id} data-testid={`card-profile-${profile.id}`}>
        <div className="profile-photo-wrap"><ProfileImage src={profile.photoUrl} name={profile.displayName} className="profile-photo" /><span className="online-tag"><span /> Open to meeting</span><button className="more-button" aria-label={`Safety options for ${profile.displayName}`} onClick={() => flag(profile.id)}><MoreHorizontal size={19} /></button></div>
         <div className="profile-card-body">{profile.id.startsWith('demo-profile-') && <span className="demo-profile-tag">Sample profile</span>}<div className="profile-title"><h2>{profile.displayName}, {profile.age}</h2><BadgeCheck size={17} /></div><div className="profile-location"><MapPin size={14} />{profile.location}</div>
          {profile.bio && <p className="profile-bio">{profile.bio}</p>}
          <div className="interest-list">{profile.interests.slice(0, 4).map(interest => <span key={interest}>{interest}</span>)}</div>
          <div className="profile-card-actions"><button type="button" className="button button-card" onClick={() => connect(profile.id)} disabled={start.isPending}><MessageCircle size={16} /> Say hello</button><button type="button" className="icon-button soft-icon" title="Report or block" onClick={() => flag(profile.id)}><ShieldAlert size={17} /></button></div>
        </div>
      </article>)}</div>}
  </Shell>;
}

function Messages() {
  const params = useParams<{ conversationId?: string }>();
  const conversationId = params?.conversationId || '';
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { data: conversations, isLoading: conversationsLoading, isError: conversationsError, refetch: refetchConversations } = useListConversations();
  const selected = conversations?.find(conversation => conversation.id === conversationId);
  const { data: messages, isLoading: messagesLoading, isError: messagesError, refetch: refetchMessages } = useListMessages(conversationId, { query: { queryKey: getListMessagesQueryKey(conversationId), enabled: !!conversationId } });
  const send = useSendMessage();
  const startCall = useStartDirectCall();
  const ticket = useCreateRealtimeTicket();
  const blockPeer = useBlockProfile();
  const reportPeer = useReportProfile();
  const [content, setContent] = useState('');
  const [conversationSearch, setConversationSearch] = useState('');
  const [premium, setPremium] = useState(false);
  const [activeCall, setActiveCall] = useState(false);
  const [incoming, setIncoming] = useState<{ callId: string; fromUserId: string } | null>(null);
  const [callStatus, setCallStatus] = useState('');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeCallId = useRef('');
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const walletQuery = useGetMyProfile();
  const credits = walletQuery.data?.credits ?? 0;
  const [, setLocation] = useLocation();

  useEffect(() => {
    let disposed = false;
    let reconnectTimer: number | undefined;
    let retry = 0;
    let disconnectedCallId = '';
    setPremium(false);
    if (!conversationId) return;
    const reconnectDelay = () => Math.min(1000 * 2 ** Math.min(retry++, 5), 30_000);
    const scheduleReconnect = () => {
      if (!disposed) reconnectTimer = window.setTimeout(() => void connect(), reconnectDelay());
    };
    const connect = async () => {
      if (disposed) return;
      try {
        const result = await ticket.mutateAsync({ conversationId });
        if (disposed) return;
        const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new WebSocket(`${scheme}//${window.location.host}/api/ws?ticket=${encodeURIComponent(result.ticket)}`);
        socketRef.current = socket;
        socket.onopen = () => {
          retry = 0;
          queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(conversationId) });
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          if (disconnectedCallId) {
            socket.send(JSON.stringify({ type: 'call:end', callId: disconnectedCallId }));
            disconnectedCallId = '';
            setCallStatus('The call ended because the connection was interrupted');
          } else {
            setCallStatus('Connected privately');
          }
        };
        socket.onclose = () => {
          if (disposed) return;
          if (activeCallId.current) {
            disconnectedCallId = activeCallId.current;
            endCall(false);
          }
          setCallStatus('Connection paused — reconnecting…');
          scheduleReconnect();
        };
        socket.onerror = () => { if (!disposed) setCallStatus('Connection unavailable — reconnecting…'); };
        socket.onmessage = event => {
        try {
          const packet = JSON.parse(event.data) as { type?: string; event?: string; data?: Record<string, unknown>; message?: { conversationId?: string } };
          const kind = packet.type || packet.event || '';
          const payload = (packet.data || packet) as Record<string, unknown>;
          if (kind === 'message:new') {
            const msg = (payload.message || packet.message) as { conversationId?: string } | undefined;
            if (!msg?.conversationId || msg.conversationId === conversationId) queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(conversationId) });
            queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          }
          if (kind === 'call:invite') {
            const callId = String(payload.callId || '');
            const fromUserId = String(payload.fromUserId || '');
            if (callId) { activeCallId.current = callId; setIncoming({ callId, fromUserId }); setCallStatus('Someone is inviting you to a video chat'); }
          }
          if (kind === 'call:accept') {
            setCallStatus('They’re here. Say hello.');
            if (pcRef.current) void pcRef.current.createOffer().then(async offer => {
              await pcRef.current?.setLocalDescription(offer);
              sendSignal('call:offer', { callId: activeCallId.current, sdp: offer });
            }).catch(() => setCallStatus('We couldn’t start the video connection.'));
          }
          if (kind === 'call:decline') { setCallStatus('They couldn’t join right now'); endCall(false); }
          if (kind === 'call:offer') {
            const sdp = payload.sdp as RTCSessionDescriptionInit;
            if (pcRef.current && sdp) void applyRemoteDescription(sdp).then(async () => {
              const answer = await pcRef.current?.createAnswer();
              if (answer) { await pcRef.current?.setLocalDescription(answer); sendSignal('call:answer', { callId: activeCallId.current, sdp: answer }); }
            }).catch(() => setCallStatus('We couldn’t prepare the video connection.'));
          }
          if (kind === 'call:answer') {
            const sdp = payload.sdp as RTCSessionDescriptionInit;
            if (pcRef.current && sdp) void applyRemoteDescription(sdp).catch(() => setCallStatus('We couldn’t prepare the video connection.'));
          }
          if (kind === 'call:ice') {
            const candidate = payload.candidate as RTCIceCandidateInit;
            if (candidate) void addRemoteCandidate(candidate).catch(() => setCallStatus('The video connection needs another moment.'));
          }
          if (kind === 'call:end') endCall(false);
        } catch { setCallStatus('We couldn’t read that update.'); }
      };
      } catch {
        if (!disposed) {
          setCallStatus('Realtime is unavailable — reconnecting…');
          scheduleReconnect();
        }
      }
    };
    void connect();
    return () => {
      disposed = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      socketRef.current?.close();
      socketRef.current = null;
      endCall(false);
    };
  // Ticket is intentionally requested once for a conversation, as the socket ticket is one-use.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => { if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream; }, [remoteStream]);
  useEffect(() => { if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream; }, [localStream]);

  function sendSignal(type: string, payload: Record<string, unknown>) {
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify({ type, ...payload }));
  }
  function endCall(notify = true) {
    if (notify && activeCallId.current) sendSignal('call:end', { callId: activeCallId.current });
    pcRef.current?.close(); pcRef.current = null;
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null; setLocalStream(null); setRemoteStream(null);
    pendingIceRef.current = [];
    activeCallId.current = ''; setActiveCall(false); setIncoming(null);
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
  }
  async function prepareMedia() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    localStreamRef.current = stream; setLocalStream(stream); return stream;
  }
  async function createPeer(stream: MediaStream) {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    pc.ontrack = event => { setRemoteStream(event.streams[0]); };
    pc.onicecandidate = event => { if (event.candidate) sendSignal('call:ice', { callId: activeCallId.current, candidate: event.candidate }); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setCallStatus('A little face-to-face time');
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') setCallStatus('The connection is a little wobbly');
    };
    return pc;
  }
  async function applyRemoteDescription(description: RTCSessionDescriptionInit) {
    const pc = pcRef.current;
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(description));
    const queued = pendingIceRef.current.splice(0);
    await Promise.all(queued.map(candidate => pc.addIceCandidate(new RTCIceCandidate(candidate))));
  }
  async function addRemoteCandidate(candidate: RTCIceCandidateInit) {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) {
      pendingIceRef.current.push(candidate);
      return;
    }
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }
  async function callPeer() {
    if (!conversationId) return;
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      setCallStatus('Reconnect before starting a video chat.');
      return;
    }
    try {
      setCallStatus('Getting your call ready…');
      const media = await prepareMedia();
      await createPeer(media);
      const result = await startCall.mutateAsync({ conversationId });
      activeCallId.current = result.callId; setActiveCall(true);
      sendSignal('call:invite', { callId: result.callId, fromUserId: user?.id || '' });
      setCallStatus('Calling…');
      if (result.creditsRemaining !== undefined) queryClient.setQueryData(getGetMyProfileQueryKey(), old => old ? { ...old, credits: result.creditsRemaining } : old);
    } catch { setCallStatus('We couldn’t start the call. Check camera access and your available credits.'); endCall(false); }
  }
  async function acceptCall() {
    if (!incoming) return;
    try {
      const media = await prepareMedia();
      await createPeer(media);
      setActiveCall(true); setCallStatus('Connecting…');
      sendSignal('call:accept', { callId: incoming.callId });
      setIncoming(null);
    } catch { setCallStatus('Camera and microphone access are needed for a video chat.'); }
  }
  function submitMessage(e: FormEvent) {
    e.preventDefault();
    if (!conversationId || !content.trim()) return;
    send.mutate({ conversationId, data: { content: content.trim(), premium: premium && !selected?.peer.id.startsWith('demo-profile-') } }, {
      onSuccess: result => {
        setContent('');
        queryClient.setQueryData(getGetMyProfileQueryKey(), old => old ? { ...old, credits: result.creditsRemaining } : old);
        queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(conversationId) });
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      },
    });
  }
  const sortedMessages = [...(messages || [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return <Shell active="/messages"><div className="messages-layout">
    <aside className={`conversation-rail ${conversationId ? 'rail-mobile-hidden' : ''}`}>
      <div className="conversation-head"><div><div className="section-kicker">Your people</div><h1>Messages</h1></div><span className="conversation-count">{conversations?.length || 0}</span></div>
      <div className="conversation-search"><Search size={16} /><input placeholder="Find a conversation" aria-label="Find a conversation" value={conversationSearch} onChange={event => setConversationSearch(event.target.value)} /></div>
      {conversationsLoading ? <div className="conversation-skeletons">{[0, 1, 2].map(i => <div key={i} className="conversation-skeleton" />)}</div>
        : conversationsError ? <div className="mini-state"><p>Couldn’t load conversations.</p><button onClick={() => refetchConversations()}>Try again</button></div>
        : !conversations?.length ? <div className="conversation-empty"><div className="empty-orbit"><MessageCircle size={24} /></div><b>Every good story starts somewhere.</b><p>Say hello to someone you’d like to know.</p><Link href="/discover" className="text-link">Meet someone <ArrowRight size={14} /></Link></div>
        : <div className="conversation-list">{conversations.filter(item => item.peer.displayName.toLowerCase().includes(conversationSearch.toLowerCase())).map(item => <Link href={`/messages/${item.id}`} key={item.id} className={`conversation-row ${conversationId === item.id ? 'conversation-selected' : ''}`} data-testid={`conversation-${item.id}`}>
          <ProfileImage src={item.peer.photoUrl} name={item.peer.displayName} className="conversation-avatar" /><div className="conversation-copy"><div className="conversation-peer"><b>{item.peer.displayName}</b><time>{item.lastMessage ? new Date(item.lastMessage.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}</time></div><p>{item.lastMessage?.content || 'Say hello to get things started'}</p></div>
        </Link>)}</div>}
    </aside>
    {conversationId && selected ? <section className="chat-pane">
       <header className="chat-head"><Link href="/messages" className="icon-button chat-back"><ArrowLeft size={18} /></Link><ProfileImage src={selected.peer.photoUrl} name={selected.peer.displayName} className="chat-avatar" /><div className="chat-peer"><b>{selected.peer.displayName}{selected.peer.id.startsWith('demo-profile-') ? ' · sample' : ''}</b><span><span className="presence-dot" /> Here for a good conversation</span></div><button className="call-button" onClick={callPeer} disabled={startCall.isPending || activeCall || !!incoming || selected.peer.id.startsWith('demo-profile-')} title={selected.peer.id.startsWith('demo-profile-') ? 'Sample profiles cannot join live calls' : undefined}><Video size={17} /><span>{selected.peer.id.startsWith('demo-profile-') ? 'Sample profile' : 'Video · 10 credits'}</span></button><button className="icon-button chat-safety" title="Safety options" onClick={() => {
        const choice = window.prompt(`Safety options for ${selected.peer.displayName}: type “report” or “block”.`);
        if (choice?.toLowerCase() === 'block') blockPeer.mutate({ profileId: selected.peer.id }, {
          onSuccess: () => { setLocation('/messages'); queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() }); },
        });
        if (choice?.toLowerCase() === 'report') {
          const reason = window.prompt('What would you like us to know? (at least 3 characters)');
          if (reason && reason.trim().length >= 3) reportPeer.mutate({ profileId: selected.peer.id, data: { reason: reason.trim() } });
        }
      }}><Shield size={18} /></button></header>
      {callStatus && <div className={`call-status ${activeCall || incoming ? 'call-status-active' : ''}`}><span className="call-status-dot" />{callStatus}{incoming && <span className="call-actions"><button onClick={acceptCall}>Accept</button><button onClick={() => { sendSignal('call:decline', { callId: incoming.callId }); setIncoming(null); setCallStatus('Call declined'); }}>Decline</button></span>}{activeCall && <button className="call-hangup" onClick={() => endCall()} aria-label="End call"><PhoneOff size={16} /></button>}</div>}
      {activeCall && <div className="video-stage"><video ref={remoteVideoRef} autoPlay playsInline className="remote-video" /><video ref={localVideoRef} autoPlay muted playsInline className="local-video" /><div className="video-overlay-label"><span className="presence-dot" /> With {selected.peer.displayName}</div><div className="video-controls"><button onClick={() => { const track = localStreamRef.current?.getAudioTracks()[0]; if (track) { track.enabled = !track.enabled; setMuted(!track.enabled); } }} aria-label={muted ? 'Turn microphone on' : 'Mute microphone'}>{muted ? <MicOff size={17} /> : <Mic size={17} />}</button><button onClick={() => { const track = localStreamRef.current?.getVideoTracks()[0]; if (track) { track.enabled = !track.enabled; setCameraOff(!track.enabled); } }} aria-label={cameraOff ? 'Turn camera on' : 'Turn camera off'}>{cameraOff ? <VideoOff size={17} /> : <Video size={17} />}</button><button className="hangup-control" onClick={() => endCall()} aria-label="End video chat"><PhoneOff size={17} /></button></div></div>}
      <div className="chat-history">
        <div className="chat-day"><span>YOUR CONVERSATION</span></div>
        {messagesLoading ? <div className="message-skeletons">{[0, 1, 2].map(i => <div key={i} className={`message-skeleton message-skeleton-${i}`} />)}</div>
          : messagesError ? <div className="mini-state"><p>Messages took a little detour.</p><button onClick={() => refetchMessages()}>Try again</button></div>
          : sortedMessages.length === 0 ? <div className="chat-empty"><span className="chat-empty-icon"><Heart size={20} /></span><h2>{selected.peer.id.startsWith('demo-profile-') ? 'A sample conversation.' : 'Make the first move.'}</h2><p>{selected.peer.id.startsWith('demo-profile-') ? 'This sample profile cannot reply. Create another account to test a live conversation.' : 'A thoughtful hello can be the start of something lovely.'}</p><span className="safe-inline"><LockKeyhole size={13} /> This conversation is just between you two</span></div>
          : sortedMessages.map(message => {
            const mine = message.senderId === user?.id;
            return <div key={message.id} className={`message-row ${mine ? 'message-mine' : ''}`} data-testid={`message-${message.id}`}><div className={`message-bubble ${message.premium ? 'message-premium' : ''}`}>{message.content}{message.premium && <span className="premium-stamp">A little extra</span>}</div><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></div>;
          })}
      </div>
      <form className="composer" onSubmit={submitMessage}><div className="composer-input-wrap"><input value={content} onChange={e => setContent(e.target.value)} placeholder="Write something genuine…" maxLength={2000} data-testid="input-message" /><button type="submit" disabled={!content.trim() || send.isPending} className="send-button" aria-label="Send message" data-testid="button-send-message"><Send size={17} /></button></div><div className="composer-meta"><label className="premium-toggle"><input type="checkbox" checked={premium} disabled={selected.peer.id.startsWith('demo-profile-')} onChange={e => setPremium(e.target.checked)} /><span className="toggle-track"><span /></span><Sparkles size={14} /> Add a little extra <small>{selected.peer.id.startsWith('demo-profile-') ? 'unavailable for samples' : 'premium · 1 credit'}</small></label><span><LockKeyhole size={12} /> Just between you two · {credits} credits</span></div>{send.isError && <p className="error-note">That message didn’t go through. Check your credits and try again.</p>}</form>
    </section> : conversationId ? <section className="chat-pane chat-unavailable"><Link href="/messages" className="text-link"><ArrowLeft size={16} /> Back to messages</Link><h2>That conversation isn’t here.</h2><p>It may have moved. Choose a conversation to keep talking.</p></section> : <section className="chat-pane chat-welcome"><div className="welcome-art"><div className="welcome-circle circle-a" /><div className="welcome-circle circle-b" /><MessageCircle size={34} /></div><div className="section-kicker">A moment worth sharing</div><h2>Good conversations<br /><em>make room for more.</em></h2><p>Pick a conversation to continue, or meet someone new and start a story of your own.</p><Link href="/discover" className="button button-small">Meet someone <ArrowRight size={15} /></Link></section>}
  </div></Shell>;
}

function Wallet() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useGetWallet();
  const buy = useBuyDemoCredits();
  const [selected, setSelected] = useState<100 | 250 | 500>(250);
  function purchase() {
    buy.mutate({ data: { credits: selected } }, { onSuccess: wallet => {
      queryClient.setQueryData(getGetWalletQueryKey(), wallet);
      queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
    } });
  }
  return <Shell active="/wallet"><div className="page-heading wallet-heading"><div><div className="section-kicker">Your little reserve</div><h1>Good chats, <em>covered.</em></h1><p>Credits are only used for optional premium messages and video calls.</p></div><div className="wallet-seal"><CreditCard size={20} /> SUHANA WALLET</div></div>
    <div className="wallet-layout"><section className="balance-card"><div className="balance-card-top"><div><span className="balance-eyebrow">AVAILABLE TO USE</span><div className="balance-amount">{isLoading ? <span className="balance-loading" /> : isError ? '—' : data?.balance ?? 0}<span>credits</span></div></div><div className="balance-mark"><WalletIcon size={23} /></div></div><div className="balance-footer"><span><LockKeyhole size={14} /> No subscription. No surprises.</span><span>1 credit = 1 lovely extra</span></div><div className="balance-ornament" /></section>
      <section className="purchase-card"><div className="purchase-intro"><div className="section-kicker">A little top-up</div><h2>Choose your <em>amount.</em></h2><p>This is a simulated demo purchase. No payment will be collected.</p></div><div className="credit-options">{([100, 250, 500] as const).map(amount => <button type="button" key={amount} className={`credit-option ${selected === amount ? 'credit-selected' : ''}`} onClick={() => setSelected(amount)}><span className="credit-option-dot">{selected === amount && <Check size={12} />}</span><b>{amount}</b><small>credits</small>{amount === 250 && <span className="popular-badge">A good start</span>}</button>)}</div><button className="button purchase-button" onClick={purchase} disabled={buy.isPending}>{buy.isPending ? 'Adding credits…' : <>Add {selected} demo credits <ArrowRight size={17} /></>}</button>{buy.isSuccess && <p className="success-note" role="status"><Check size={15} /> Your demo credits are ready.</p>}{buy.isError && <p className="error-note" role="alert">That didn’t work just now. Please try again.</p>}</section></div>
    <section className="activity-section"><div className="activity-header"><div><div className="section-kicker">The details</div><h2>Recent activity</h2></div><span className="activity-privacy"><Shield size={14} /> Visible only to you</span></div>
      {isLoading ? <div className="activity-skeletons">{[0, 1, 2].map(i => <div className="activity-skeleton" key={i} />)}</div>
        : isError ? <div className="activity-empty"><p>Your activity couldn’t load.</p><button className="text-link" onClick={() => refetch()}>Try again <ArrowRight size={14} /></button></div>
        : !data?.transactions.length ? <div className="activity-empty"><div className="activity-empty-mark"><Plus size={18} /></div><div><b>A clean slate.</b><p>Your credit activity will find a home here.</p></div></div>
        : <div className="transaction-list">{data.transactions.map(item => <div className="transaction-row" key={item.id} data-testid={`transaction-${item.id}`}><span className={`transaction-icon ${item.amount > 0 ? 'transaction-plus' : ''}`}>{item.amount > 0 ? <Plus size={17} /> : <ArrowRight size={16} />}</span><div className="transaction-description"><b>{item.reason}</b><time>{new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</time></div><strong className={item.amount > 0 ? 'amount-positive' : ''}>{item.amount > 0 ? '+' : ''}{item.amount}</strong></div>)}</div>}
    </section>
  </Shell>;
}

function ProfileEditor() {
  const queryClient = useQueryClient();
  const [, setRoute] = useLocation();
  const { data, isLoading, isError, refetch } = useGetMyProfile();
  const save = useSaveMyProfile();
  const profile = data?.profile;
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [location, setProfileLocation] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [bio, setBio] = useState('');
  const [interestsInput, setInterestsInput] = useState('');
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (profile && !initialized) {
      setDisplayName(profile.displayName); setAge(String(profile.age)); setGender(profile.gender);
      setProfileLocation(profile.location); setPhotoUrl(profile.photoUrl || ''); setBio(profile.bio || '');
      setInterestsInput(profile.interests.join(', ')); setInitialized(true);
    }
  }, [profile, initialized]);
  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({ data: {
      displayName: displayName.trim(), age: Number(age), gender: gender.trim(),
      location: location.trim(),
      interests: interestsInput.split(',').map(item => item.trim()).filter(Boolean).slice(0, 12),
      photoUrl: photoUrl.trim() || null, bio: bio.trim() || null,
    } }, { onSuccess: saved => {
      queryClient.setQueryData(getGetMyProfileQueryKey(), old => old ? { ...old, profile: saved } : { profile: saved, credits: 0 });
      setInitialized(true);
      if (!profile) setRoute('/discover');
    } });
  }
  return <Shell active="/profile"><div className="page-heading profile-editor-heading"><div><div className="section-kicker">A small introduction</div><h1>Your story, <em>your way.</em></h1><p>Share what you’d love someone to know before they say hello.</p></div></div>
    {isLoading ? <div className="editor-loading"><div className="profile-preview-skeleton" /><div className="form-skeleton" /></div> : isError ? <div className="state-card"><h2>Your profile is taking a moment.</h2><p>We couldn’t load your profile details just now.</p><button className="button button-small" onClick={() => refetch()}>Try again <ArrowRight size={15} /></button></div> : <div className="editor-layout">
      <section className="profile-preview-card"><div className="preview-label"><span>YOUR PROFILE CARD</span><span className="preview-live"><span /> PREVIEW</span></div><div className="preview-photo"><ProfileImage src={photoUrl} name={displayName || 'S'} className="preview-person" /><span className="preview-photo-overlay" /><div className="preview-photo-copy"><h2>{displayName || 'Your name'}{age ? `, ${age}` : ''}</h2><p><MapPin size={13} />{location || 'Your city'}</p></div></div><div className="preview-details"><p>{bio || 'A little about you will make this feel like you.'}</p><div className="interest-list">{interestsInput.split(',').map(item => item.trim()).filter(Boolean).slice(0, 4).map(item => <span key={item}>{item}</span>)}</div><div className="preview-privacy"><LockKeyhole size={13} /> Only people you choose to connect with can see more.</div></div></section>
      <form className="profile-form" onSubmit={submit}><div className="profile-form-head"><div><div className="section-kicker">The essentials</div><h2>Tell us a little.</h2></div><span className="form-save-note"><LockKeyhole size={13} /> You’re in control</span></div>
        <div className="form-row"><label className="field-label">What should we call you?<input required maxLength={60} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your first name" data-testid="input-display-name" /></label><label className="field-label age-field">Your age<input required type="number" min={18} max={120} value={age} onChange={e => setAge(e.target.value)} placeholder="18+" data-testid="input-age" /></label></div>
        <div className="form-row"><label className="field-label">Gender<input required maxLength={40} value={gender} onChange={e => setGender(e.target.value)} placeholder="How do you describe yourself?" data-testid="input-gender" /></label><label className="field-label">Where are you based?<input required maxLength={120} value={location} onChange={e => setProfileLocation(e.target.value)} placeholder="City, neighborhood" data-testid="input-location" /></label></div>
        <label className="field-label">Photo URL <span className="field-optional">Optional</span><input type="url" maxLength={2000} value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="https://…" data-testid="input-photo-url" /><small className="field-hint">Use a photo that feels like you. Keep your privacy in mind.</small></label>
        <label className="field-label">A few things you love<input value={interestsInput} onChange={e => setInterestsInput(e.target.value)} placeholder="Film photography, long walks, spicy food" data-testid="input-interests" /><small className="field-hint">Separate each interest with a comma · up to 12</small></label>
        <label className="field-label">Your little introduction<textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={500} rows={4} placeholder="What’s something you could talk about for hours?" data-testid="input-bio" /><small className="field-hint">{bio.length}/500</small></label>
        {save.isError && <p className="error-note">We couldn’t save that just now. Your words are still here—try again.</p>}
        {save.isSuccess && <p className="success-note"><Check size={15} /> Profile saved. That sounds like you.</p>}
        <button type="submit" className="button save-profile-button" disabled={save.isPending}>{save.isPending ? 'Saving your story…' : <>Save your profile <ArrowRight size={16} /></>}</button>
      </form>
    </div>}
  </Shell>;
}

function SignInPage() {
  return <div className="auth-screen"><div className="auth-aside"><Brand inverse /><div className="auth-aside-copy"><div className="section-kicker">A little more human</div><h1>Here’s to<br /><em>what’s next.</em></h1><p>Pick up where your next good conversation begins.</p><span className="auth-decoration"><Heart size={19} /></span></div><span className="auth-aside-bottom">Kindness first. Your pace, always.</span></div><div className="auth-form-side"><Link href="/" className="auth-back"><ArrowLeft size={15} /> Back to Suhana</Link><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div></div>;
}
function SignUpPage() {
  return <div className="auth-screen"><div className="auth-aside"><Brand inverse /><div className="auth-aside-copy"><div className="section-kicker">There’s room for you</div><h1>Your next<br /><em>chapter awaits.</em></h1><p>Meet the people who make an ordinary day feel a little brighter.</p><span className="auth-decoration"><Sparkles size={19} /></span></div><span className="auth-aside-bottom">Make room for a new story.</span></div><div className="auth-form-side"><Link href="/" className="auth-back"><ArrowLeft size={15} /> Back to Suhana</Link><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div></div>;
}

function HomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/discover" /></Show><Show when="signed-out"><Landing /></Show></>;
}
function AuthenticatedPage({ children }: { children: ReactNode }) {
  return <Protected>{children}</Protected>;
}
function NotFound() {
  return <div className="not-found"><Brand /><span className="section-kicker">A wrong turn</span><h1>This page took<br /><em>a different path.</em></h1><p>Let’s get you back to the good part.</p><Link href="/discover" className="button">Go to discovery <ArrowRight size={16} /></Link></div>;
}

function ClerkCacheInvalidator() {
  const { addListener } = useClerk();
  const cache = useQueryClient();
  const prev = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const id = user?.id ?? null;
    if (prev.current !== undefined && prev.current !== id) cache.clear();
    prev.current = id;
  }), [addListener, cache]);
  return null;
}
function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Your next good conversation is waiting.' } }, signUp: { start: { title: 'Make room for a new story', subtitle: 'A thoughtful hello starts right here.' } } }}
    routerPush={to => setLocation(stripBase(to))} routerReplace={to => setLocation(stripBase(to), { replace: true })}>
    <QueryClientProvider client={queryClient}><ThemeRoot><ClerkCacheInvalidator /><Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/discover"><AuthenticatedPage><Discovery /></AuthenticatedPage></Route>
      <Route path="/messages"><AuthenticatedPage><Messages /></AuthenticatedPage></Route>
      <Route path="/messages/:conversationId"><AuthenticatedPage><Messages /></AuthenticatedPage></Route>
      <Route path="/wallet"><AuthenticatedPage><Wallet /></AuthenticatedPage></Route>
      <Route path="/profile"><AuthenticatedPage><ProfileEditor /></AuthenticatedPage></Route>
      <Route component={NotFound} />
    </Switch></ThemeRoot></QueryClientProvider>
  </ClerkProvider>;
}
function App() {
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  return <WouterRouter base={basePath}><ClerkRoutes /></WouterRouter>;
}
export default App;