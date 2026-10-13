import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { Icon } from './icons';
import { MapView } from './components/MapView';
import { SessionClock } from './components/SessionClock';
import { RouteOptions } from './components/RouteOptions';
import { importImages } from './import/importMap';
import { demo, junctions, type Campus, type Place } from './data';
import {
  findAlternatives,
  routePoints,
  categoryFor,
  SESSION_MS,
  isExpired,
  remainingTime,
  validateMap,
} from './engine.mjs';
import { readSession, writeSession, clearSession } from './storage';
import { ThemeSwitch, Dialog } from './components/ui';
import { Scanner } from './components/Scanner';
import { matchesPlace } from './search.mjs';
import './style.css';

type Session = { expiresAt: number; campus: Campus | null; saved: string[] };
type Modal = 'upload' | 'scan' | 'share' | 'help' | 'pin' | 'review' | null;
const fresh = (): Session => ({ expiresAt: Date.now() + SESSION_MS, campus: null, saved: [] });
function App() {
  const [session, setSession] = useState<Session>(fresh),
    [ready, setReady] = useState(false),
    [expired, setExpired] = useState(false);
  const [selected, setSelected] = useState('library'),
    [query, setQuery] = useState(''),
    [category, setCategory] = useState('All places'),
    [directions, setDirections] = useState(false),
    [start, setStart] = useState('gate'),
    [accessible, setAccessible] = useState(false),
    [walking, setWalking] = useState(false),
    [step, setStep] = useState(0);
  const [drawer, setDrawer] = useState(false),
    [modal, setModal] = useState<Modal>(null),
    [toast, setToast] = useState(''),
    [dark, setDark] = useState(document.documentElement.dataset.theme === 'dark');
  const [floor, setFloor] = useState(0),
    [mobileList, setMobileList] = useState(false),
    [edit, setEdit] = useState<'none' | 'pin' | 'connect'>('none'),
    [connectFrom, setConnectFrom] = useState<string | null>(null),
    [newPoint, setNewPoint] = useState({ x: 0, y: 0 }),
    [newName, setNewName] = useState(''),
    [newCategory, setNewCategory] = useState('Study'),
    [pathAccessible, setPathAccessible] = useState(false),
    [busy, setBusy] = useState(false),
    [uploadError, setUploadError] = useState(''),
    [link, setLink] = useState('');
  const file = useRef<HTMLInputElement>(null),
    toastTimer = useRef<number>(0);
  const [activeRoute, setActiveRoute] = useState(0),
    [uploadProgress, setUploadProgress] = useState(''),
    [reviewChecked, setReviewChecked] = useState(false);
  const uploadController = useRef<AbortController | null>(null);
  const campus = session.campus || demo,
    isCustom = !!session.campus;
  const reviewed = !isCustom || campus.images[floor]?.reviewed === true;
  const nodes = useMemo(
    () =>
      isCustom ? [...campus.places, ...(campus.junctions ?? [])] : [...campus.places, ...junctions],
    [campus, isCustom],
  );
  const place = campus.places.find((p) => p.id === selected);
  const routes = useMemo(
    () => findAlternatives(nodes, campus.edges, start, selected, accessible, !reviewed),
    [nodes, campus.edges, start, selected, accessible, reviewed],
  );
  const route = routes[activeRoute] ?? routes[0];
  const paths = useMemo(
    () => routes.map((r) => routePoints(r, nodes, campus.edges)),
    [routes, nodes, campus.edges],
  );
  const pathNodes: Place[] = route
    ? route.path.map((id: string) => nodes.find((p) => p.id === id)!)
    : [];
  const metres = route ? Math.round((route.distance * 0.6) / 5) * 5 : 0,
    minutes = route?.distance === 0 ? 0 : Math.max(1, Math.ceil(metres / 70));
  const filtered = [...campus.places]
    .sort((a, b) => (a.id === 'gate' ? 1 : 0) - (b.id === 'gate' ? 1 : 0))
    .filter(
      (p) =>
        p.floor === floor &&
        (category === 'All places' || category === 'Saved'
          ? category !== 'Saved' || session.saved.includes(p.id)
          : p.category === category) &&
        matchesPlace(p, query),
    );
  const notify = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 4500);
  };
  const changeCampus = (c: Campus | null) => {
    setSession((s) => ({ ...s, campus: c, saved: [] }));
    setFloor(0);
    setSelected(c?.places[0]?.id || 'library');
    setStart(c?.places[0]?.id || 'gate');
    setDirections(false);
    setWalking(false);
    setEdit('none');
    setQuery('');
    setCategory('All places');
    setActiveRoute(0);
  };
  useEffect(() => {
    let live = true;
    readSession()
      .then((saved) => {
        if (!live) return;
        const hasEntry = new URLSearchParams(location.search).get('campus') === 'demo';
        if (hasEntry) {
          setSession(fresh());
          const entry = new URLSearchParams(location.search).get('entry');
          if (entry && demo.places.some((p) => p.id === entry)) setStart(entry);
          history.replaceState(null, '', location.pathname);
          return;
        }
        if (saved && isExpired(saved.expiresAt)) {
          clearSession().catch(() => {});
          setExpired(true);
        } else if (saved) {
          try {
            const c = saved.campus ? (validateMap(saved.campus) as Campus) : null;
            setSession({
              expiresAt: saved.expiresAt,
              campus: c,
              saved: Array.isArray(saved.saved)
                ? saved.saved.filter((x: unknown) => typeof x === 'string')
                : [],
            });
            if (c) {
              setSelected(c.places[0]?.id || '');
              setStart(c.places[0]?.id || '');
            }
          } catch {
            clearSession().catch(() => {});
          }
        }
      })
      .catch(() =>
        notify('Private browser storage is unavailable. Your map will stay in this tab only.'),
      )
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (ready && !expired)
      writeSession(session).catch(() =>
        notify('Your browser could not save this session. Your map will stay in this tab only.'),
      );
  }, [session, ready, expired]);
  useEffect(() => {
    if (!ready || expired) return;
    const tick = () => {
      const left = remainingTime(session.expiresAt);
      if (left === 0) {
        uploadController.current?.abort();
        setExpired(true);
        setModal(null);
        setDrawer(false);
        setSession((s) => ({ ...s, campus: null, saved: [] }));
        clearSession().catch(() => {});
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    const resume = () => tick();
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [ready, expired, session.expiresAt]);
  useEffect(() => {
    if (!directions) {
      setWalking(false);
      setStep(0);
    }
  }, [directions]);
  useEffect(() => {
    setWalking(false);
    setStep(0);
    setActiveRoute(0);
  }, [start, selected, accessible, campus.edges]);
  useEffect(
    () => () => {
      uploadController.current?.abort();
      clearTimeout(toastTimer.current);
    },
    [],
  );
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEdit('none');
        setDrawer(false);
      }
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try {
      localStorage.setItem('uniway-theme', next ? 'dark' : 'light');
    } catch {}
  };
  const pick = (p: Place) => {
    if (edit === 'connect') {
      if (!connectFrom) {
        setConnectFrom(p.id);
        notify('Now select the other end of this walkway.');
      } else if (connectFrom === p.id) {
        setConnectFrom(null);
      } else {
        const a = campus.places.find((x) => x.id === connectFrom);
        if (a?.floor !== p.floor) {
          notify('Connect places on the same map image.');
          return;
        }
        if (
          campus.edges.some(
            (e) => (e.a === connectFrom && e.b === p.id) || (e.b === connectFrom && e.a === p.id),
          )
        ) {
          notify('These places are already connected.');
          setConnectFrom(null);
          return;
        }
        setSession((s) => ({
          ...s,
          campus: {
            ...campus,
            edges: [
              ...campus.edges,
              {
                a: connectFrom,
                b: p.id,
                accessible: pathAccessible,
                confirmed: true,
                source: 'manual',
              },
            ],
          },
        }));
        setConnectFrom(null);
        notify('Walkway added.');
      }
      return;
    }
    setSelected(p.id);
    setFloor(p.floor);
    setMobileList(false);
  };
  const savePlace = () => {
    if (!place) return;
    const exists = session.saved.includes(place.id);
    setSession((s) => ({
      ...s,
      saved: exists ? s.saved.filter((id) => id !== place.id) : [...s.saved, place.id],
    }));
    notify(exists ? 'Place removed from saved places.' : 'Saved for this session.');
  };
  const resetSession = () => {
    setSession(fresh());
    setExpired(false);
    setDrawer(false);
    setSelected('library');
    setStart('gate');
    setFloor(0);
    setDirections(false);
    setWalking(false);
    setQuery('');
    setCategory('All places');
    setEdit('none');
    setActiveRoute(0);
  };
  const readQr = (value: string) => {
    try {
      const u = new URL(value);
      if (u.origin !== location.origin || u.searchParams.get('campus') !== 'demo') throw Error();
      resetSession();
      const entry = u.searchParams.get('entry');
      if (entry && demo.places.some((p) => p.id === entry)) {
        setStart(entry);
        setSelected(entry);
      }
      setModal(null);
      notify('Campus opened. Your three-hour session has started.');
    } catch {
      notify('This is not a supported UniWay campus link. Try the demo QR in “Share campus”.');
    }
  };
  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setUploadError('');
    setUploadProgress('Preparing your layout…');
    uploadController.current?.abort();
    const controller = new AbortController();
    uploadController.current = controller;
    try {
      const selectedFiles = Array.from(files);
      let c: Campus;
      if (selectedFiles.length === 1 && /\.(json|uniway)$/i.test(selectedFiles[0].name)) {
        if (selectedFiles[0].size > 32_000_000)
          throw new Error('This map file is too large (32 MB maximum).');
        c = validateMap(JSON.parse(await selectedFiles[0].text())) as Campus;
      } else c = await importImages(selectedFiles, controller.signal, setUploadProgress);
      if (controller.signal.aborted || isExpired(session.expiresAt)) return;
      changeCampus(c);
      setModal(null);
      notify(`${c.places.length} places found. Your generated map is ready to review.`);
    } catch (error) {
      if (!controller.signal.aborted)
        setUploadError(
          error instanceof Error
            ? error.message
            : 'We could not read that image. Try a sharper layout photo.',
        );
    } finally {
      setBusy(false);
      setUploadProgress('');
      if (file.current) file.current.value = '';
    }
  };
  const openReview = () => {
    setReviewChecked(false);
    setModal('review');
  };
  const confirmReview = () => {
    setSession((old) => ({
      ...old,
      campus: {
        ...campus,
        images: campus.images.map((image, i) =>
          i === floor ? { ...image, reviewed: true } : image,
        ),
        edges: campus.edges.map((edge) =>
          nodes.find((n) => n.id === edge.a)?.floor === floor ? { ...edge, confirmed: true } : edge,
        ),
      },
    }));
    setModal(null);
    notify('Paths confirmed for this map. Step-free access still needs its own check.');
  };
  const addPin = () => {
    if (!newName.trim()) return;
    const p: Place = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      x: newPoint.x,
      y: newPoint.y,
      floor,
      category: newCategory,
      icon:
        newCategory === 'Study'
          ? 'book'
          : newCategory === 'Food'
            ? 'coffee'
            : newCategory === 'Outdoors'
              ? 'leaf'
              : 'pin',
      description: 'A place you added to this map.',
    };
    setSession((s) => ({ ...s, campus: { ...campus, places: [...campus.places, p] } }));
    setSelected(p.id);
    if (!campus.places.length || !campus.places.some((q) => q.id === start)) setStart(p.id);
    setModal(null);
    setNewName('');
    notify('Place added. Add another, or connect your walkways.');
  };
  const routeText = (index: number) => {
    if (index === 0) return `Start at ${pathNodes[0]?.name}.`;
    if (index === pathNodes.length - 1) return `Arrive at ${place?.name}.`;
    const a = pathNodes[index - 1],
      b = pathNodes[index],
      c = pathNodes[index + 1];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    const dot = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y);
    return `${Math.abs(cross) < Math.abs(dot) * 0.4 ? 'Continue straight' : cross > 0 ? 'Turn right' : 'Turn left'} at ${b.category === 'Path' ? 'the path junction' : b.name}.`;
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setDirections(false);
            setDrawer(false);
            setMobileList(false);
          }}
          aria-label="UniWay home"
        >
          <span className="brand-symbol">
            <svg viewBox="0 0 32 32" fill="none">
              <path
                d="M8 6v13a8 8 0 0 0 16 0V6"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="m19 10 5-5 5 5"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="8" cy="6" r="2.5" fill="#b76a4c" />
            </svg>
          </span>
          uniway<span className="brand-period">.</span>
        </a>
        <span className="header-divider" />
        <span className="brand-tagline">
          A little direction.
          <br />A lot more campus.
        </span>
        <nav className="header-nav" aria-label="Main">
          <button
            className={!drawer ? 'active' : ''}
            onClick={() => {
              setDrawer(false);
              setMobileList(false);
            }}
          >
            <Icon name="map" size={18} />
            Explore campus
          </button>
          <button className={drawer ? 'active' : ''} onClick={() => setDrawer(true)}>
            <Icon name="clock" size={18} />
            My session
            <span className="live-dot" />
          </button>
        </nav>
        <div className="header-actions">
          <ThemeSwitch dark={dark} toggle={toggleTheme} />
          <button
            className="secondary upload-header"
            onClick={() => {
              setUploadError('');
              setModal('upload');
            }}
          >
            <Icon name="upload" size={17} />
            Add a map
          </button>
          <button
            className="profile-button"
            aria-label="Open your session"
            onClick={() => setDrawer(true)}
          >
            U
          </button>
        </div>
      </header>
      <main className="workspace">
        <aside
          className={`sidebar ${mobileList ? 'mobile-open' : ''}`}
          aria-label="Find a campus destination"
        >
          <div className="sidebar-scroll">
            <div className="campus-meta">
              <span className="tiny-leaf">
                <Icon name="leaf" size={14} />
              </span>
              {isCustom ? 'YOUR PERSONAL CAMPUS MAP' : 'GREENFIELD UNIVERSITY'}
              <span className="demo-tag">{isCustom ? 'LOCAL' : 'DEMO'}</span>
            </div>
            {directions ? (
              <>
                <button className="text-button back-link" onClick={() => setDirections(false)}>
                  <Icon name="back" size={15} />
                  Back to places
                </button>
                <h1>
                  Your way,
                  <br />
                  <em>made simple.</em>
                </h1>
                <p className="intro">A clear path to your next stop.</p>
                <div className="route-inputs">
                  <div className="route-input-row">
                    <span className="start-dot" />
                    <label>
                      <span>STARTING POINT</span>
                      <select
                        aria-label="Starting point"
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                      >
                        {campus.places
                          .filter((p) => p.floor === floor)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                  <div className="route-input-row">
                    <Icon name="pin" size={16} />
                    <label>
                      <span>YOUR DESTINATION</span>
                      <select
                        aria-label="Destination"
                        value={selected}
                        onChange={(e) => setSelected(e.target.value)}
                      >
                        {campus.places
                          .filter((p) => p.floor === floor)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                </div>
                <label className="accessible-option">
                  <Icon name="wheelchair" size={20} />
                  <span>Step-free paths only</span>
                  <input
                    type="checkbox"
                    checked={accessible}
                    onChange={(e) => setAccessible(e.target.checked)}
                  />
                </label>
                {route ? (
                  <>
                    <div className="route-summary">
                      <span>
                        <strong>{isCustom ? 'Route preview' : `${minutes} min`}</strong>
                        <small>
                          {isCustom ? 'Distance compared on your layout' : `${metres} m · walking`}
                        </small>
                      </span>
                      <span className="route-badge">
                        <Icon name="walk" size={16} />
                        {accessible ? 'Step-free' : 'Walking'}
                      </span>
                    </div>
                    <div className="route-note">
                      <Icon name="info" size={16} />
                      <p>
                        {isCustom
                          ? reviewed
                            ? 'Paths confirmed by you. No live positioning.'
                            : 'Preview only. Review detected paths before starting directions.'
                          : 'Illustrative route on a fictional campus. Start location is selected manually.'}
                      </p>
                    </div>
                    <RouteOptions
                      routes={routes}
                      active={activeRoute}
                      select={(index) => {
                        setActiveRoute(index);
                        setWalking(false);
                        setStep(0);
                      }}
                      calibrated={!isCustom}
                    />
                    <ol className="steps">
                      {pathNodes.map((n, i) => (
                        <li className={walking && step === i ? 'current' : ''} key={n.id}>
                          <span className="step-dot">
                            {i === pathNodes.length - 1 ? <Icon name="pin" size={14} /> : i + 1}
                          </span>
                          <div>
                            <strong>{routeText(i)}</strong>
                            {i < pathNodes.length - 1 && (
                              <small>
                                {isCustom
                                  ? 'Along your marked walkway'
                                  : `About ${Math.max(5, Math.round((Math.hypot(n.x - pathNodes[i + 1].x, n.y - pathNodes[i + 1].y) * 0.6) / 5) * 5)} m`}
                              </small>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                    <button
                      className="primary full"
                      disabled={!reviewed}
                      onClick={() => {
                        setWalking(true);
                        setStep(0);
                        setMobileList(false);
                      }}
                    >
                      <Icon name="walk" />
                      {walking
                        ? 'Restart directions'
                        : reviewed
                          ? 'Start directions'
                          : 'Review paths to start'}
                      <Icon name="arrow" />
                    </button>
                    {!reviewed && (
                      <button className="text-button full" onClick={openReview}>
                        Review generated map
                        <Icon name="arrow" size={16} />
                      </button>
                    )}
                  </>
                ) : (
                  <div className="empty-state">
                    <Icon name="route" size={30} />
                    <h3>No connected route yet</h3>
                    <p>
                      {accessible
                        ? 'No confirmed step-free path connects these places. Try another destination or turn off the filter.'
                        : 'No connected path was detected between these places. Check the source, or add the missing walkway in the editor.'}
                    </p>
                    {isCustom && (
                      <button
                        className="secondary"
                        onClick={() => {
                          setDirections(false);
                          setEdit('connect');
                        }}
                      >
                        Connect walkways
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <h1>
                  Find your place.
                  <br />
                  <em>Feel at home.</em>
                </h1>
                <p className="intro">
                  Less time finding your way.
                  <br />
                  More time making it yours.
                </p>
                <div className="search-field">
                  <Icon name="search" />
                  <input
                    aria-label="Search campus places"
                    placeholder="Where are you headed?"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query ? (
                    <button
                      className="clear-search"
                      aria-label="Clear search"
                      onClick={() => setQuery('')}
                    >
                      <Icon name="close" size={15} />
                    </button>
                  ) : (
                    <span className="search-key">⌕</span>
                  )}
                </div>
                <div className="category-chips" aria-label="Place categories">
                  {[
                    ['All places', ''],
                    ['Study', 'book'],
                    ['Food', 'coffee'],
                    ['Services', 'people'],
                    ['Outdoors', 'leaf'],
                    ['Saved', 'bookmark'],
                  ].map(([c, i]) => (
                    <button
                      key={c}
                      className={category === c ? 'selected' : ''}
                      aria-pressed={category === c}
                      onClick={() => setCategory(c)}
                    >
                      {i && <Icon name={i} size={14} />} {c}
                    </button>
                  ))}
                </div>
                <div className="section-label">
                  <span>
                    {query
                      ? 'SEARCH RESULTS'
                      : category === 'Saved'
                        ? 'YOUR SAVED PLACES'
                        : 'A FEW PLACES TO START'}
                  </span>
                  <span>{filtered.length} places</span>
                </div>
                <div className="place-list">
                  {filtered.map((p) => (
                    <button
                      key={p.id}
                      className={`place-row ${selected === p.id ? 'selected' : ''}`}
                      onClick={() => pick(p)}
                    >
                      <span className={`place-icon ${p.category.toLowerCase()}`}>
                        <Icon name={p.icon} />
                      </span>
                      <span className="place-copy">
                        <strong>{p.name}</strong>
                        <small>
                          {p.category}
                          {!isCustom ? ' · Campus ground level' : ''}
                        </small>
                      </span>
                      <Icon name="chevron" size={16} />
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <div className="empty-state">
                      <Icon name={isCustom && !campus.places.length ? 'pin' : 'search'} size={28} />
                      <h3>
                        {isCustom && !campus.places.length
                          ? 'Make this map yours'
                          : 'No places found'}
                      </h3>
                      <p>
                        {isCustom && !campus.places.length
                          ? 'Click “Add places”, then click your map to name a destination.'
                          : 'Try another name or choose a different category.'}
                      </p>
                      {isCustom && !campus.places.length && (
                        <button
                          className="secondary"
                          onClick={() => {
                            setEdit('pin');
                            setMobileList(false);
                          }}
                        >
                          Add places
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="sidebar-bottom">
            <button className="scan-card" onClick={() => setModal('scan')}>
              <span className="scan-icon">
                <Icon name="qr" size={26} />
              </span>
              <span>
                <strong>A new campus? You’re in.</strong>
                <small>Scan a QR code to find your way.</small>
              </span>
              <Icon name="arrow" size={18} />
            </button>
            <div className="sidebar-footer">
              <span>
                <span className="online-dot" />
                Your map stays on this device
              </span>
              <button aria-label="About UniWay and privacy" onClick={() => setModal('help')}>
                <Icon name="info" size={16} />
              </button>
            </div>
          </div>
        </aside>
        <MapView
          campus={campus}
          custom={isCustom}
          floor={floor}
          selected={place}
          start={start}
          directions={directions}
          paths={paths}
          activeRoute={activeRoute}
          walking={walking}
          currentStep={pathNodes[step]}
          saved={!!place && session.saved.includes(place.id)}
          minutes={minutes}
          startName={campus.places.find((p) => p.id === start)?.name || 'starting point'}
          edit={edit}
          connectFrom={connectFrom}
          pathAccessible={pathAccessible}
          onPathAccessible={setPathAccessible}
          onFloor={(f) => {
            setFloor(f);
            const first = campus.places.find((p) => p.floor === f);
            setSelected(first?.id || '');
            setStart(first?.id || '');
            setDirections(false);
            setConnectFrom(null);
            setActiveRoute(0);
          }}
          onSelect={pick}
          onAdd={(point) => {
            setNewPoint(point);
            setNewName('');
            setModal('pin');
          }}
          onEdit={(mode) => {
            setEdit(mode);
            setDirections(false);
            setConnectFrom(null);
          }}
          onSave={savePlace}
          onDirections={() => {
            setDirections(true);
            setMobileList(true);
          }}
          onReview={openReview}
          onHelp={() => setModal('help')}
          onShare={() => setModal('share')}
          onDelete={() => {
            if (!place) return;
            setSession((old) => ({
              ...old,
              campus: {
                ...campus,
                places: campus.places.filter((p) => p.id !== place.id),
                edges: campus.edges.filter((e) => e.a !== place.id && e.b !== place.id),
              },
            }));
            setSelected('');
            setConnectFrom(null);
            notify('Place and connected paths removed.');
          }}
        >
          {walking && route && (
            <div className="navigation-card">
              <div className="navigation-top">
                <span className="navigation-icon">
                  <Icon name={step === pathNodes.length - 1 ? 'check' : 'walk'} size={25} />
                </span>
                <div>
                  <span className="eyebrow">
                    {step === pathNodes.length - 1
                      ? 'YOU MADE IT'
                      : `STEP ${step + 1} OF ${pathNodes.length}`}
                  </span>
                  <h3>{routeText(step)}</h3>
                </div>
                <button
                  className="icon-button"
                  aria-label="End directions"
                  onClick={() => setWalking(false)}
                >
                  <Icon name="close" />
                </button>
              </div>
              <p>Advance as you walk. Your position is not tracked.</p>
              <div className="navigation-actions">
                <button
                  className="secondary"
                  disabled={step === 0}
                  onClick={() => setStep((s) => s - 1)}
                >
                  Previous
                </button>
                <button
                  className="primary"
                  onClick={() =>
                    step === pathNodes.length - 1
                      ? (setWalking(false), notify('You have reached your destination.'))
                      : setStep((s) => s + 1)
                  }
                >
                  {step === pathNodes.length - 1 ? 'Finish' : 'Next step'}
                  <Icon name="arrow" size={16} />
                </button>
              </div>
            </div>
          )}
          <button className="mobile-search" onClick={() => setMobileList(!mobileList)}>
            <Icon name={mobileList ? 'map' : 'search'} size={18} />
            {mobileList ? 'Show map' : directions ? 'Route steps' : 'Find a place'}
          </button>
        </MapView>
      </main>
      {drawer && (
        <Dialog
          title="Make yourself at home."
          subtitle="Your campus, your saved places, your little pocket of time."
          close={() => setDrawer(false)}
        >
          <SessionClock expiresAt={session.expiresAt} />
          <div className="session-note">
            <Icon name="info" size={18} />
            <p>
              At three hours, UniWay clears this browser’s map session, uploaded images, and saved
              places. Screenshots cannot be revoked.
            </p>
          </div>
          <div className="session-row">
            <span>
              <strong>Make it feel like you</strong>
              <small>{dark ? 'A quieter view after dark' : 'A little daylight for your map'}</small>
            </span>
            <ThemeSwitch dark={dark} toggle={toggleTheme} />
          </div>
          <div className="session-row">
            <span>
              <strong>{session.saved.length} saved places</strong>
              <small>Kept until this session ends</small>
            </span>
            <button
              className="text-button"
              onClick={() => {
                setDrawer(false);
                setDirections(false);
                setCategory('Saved');
                setMobileList(true);
              }}
            >
              View
              <Icon name="arrow" size={16} />
            </button>
          </div>
          <div className="session-buttons">
            <button
              className="secondary full"
              onClick={() => {
                setDrawer(false);
                setUploadError('');
                setModal('upload');
              }}
            >
              <Icon name="upload" />
              Add a campus map
            </button>
          </div>
          <button
            className="end-session"
            onClick={() => {
              uploadController.current?.abort();
              setModal(null);
              setExpired(true);
              setDrawer(false);
              setSession((s) => ({ ...s, campus: null, saved: [] }));
              clearSession().catch(() => {});
            }}
          >
            End session & clear my data
          </button>
        </Dialog>
      )}
      {modal === 'upload' && (
        <Dialog
          title="Every campus starts here."
          subtitle="Bring a photo of your campus layout. Make it a map you can actually use."
          close={() => {
            uploadController.current?.abort();
            setModal(null);
          }}
        >
          <div
            className="upload-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) handleFiles(e.dataTransfer.files);
            }}
          >
            <span className="upload-circle">
              <Icon name="map" size={32} />
            </span>
            <h3>{busy ? 'Reading your campus layout…' : 'Drop your map images here'}</h3>
            <p>JPG, PNG or WebP · Up to 8 images, 15 MB each</p>
            <button className="primary" disabled={busy} onClick={() => file.current?.click()}>
              <Icon name="upload" size={17} />
              {busy ? 'Please wait' : 'Choose files'}
            </button>
            <input
              ref={file}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,.json,.uniway"
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />
            <small role="status">
              {busy ? uploadProgress : 'Clear labels and distinct roads give the best results.'}
            </small>
            {busy && (
              <button className="text-button" onClick={() => uploadController.current?.abort()}>
                Cancel import
              </button>
            )}
          </div>
          {uploadError && (
            <p role="alert" className="error-message">
              {uploadError}
            </p>
          )}
          <div className="upload-steps">
            <span>
              <b>01</b>Upload your layout
            </span>
            <span>
              <b>02</b>We read the layout
            </span>
            <span>
              <b>03</b>Review your new map
            </span>
          </div>
          <div className="session-note">
            <Icon name="shield" size={20} />
            <p>
              Place labels and building shapes are read on your device. A clean interactive map
              appears automatically. Review detected paths before starting directions. English
              labels are supported first.
            </p>
          </div>
          {isCustom && (
            <button
              className="text-button"
              onClick={() => {
                changeCampus(null);
                setModal(null);
              }}
            >
              Return to the demo campus
              <Icon name="arrow" size={16} />
            </button>
          )}
        </Dialog>
      )}
      {modal === 'review' && (
        <Dialog
          title="Does this look right?"
          subtitle="Compare the detected labels and paths with your original layout. Remove any path that is not a real walkway."
          close={() => setModal(null)}
          wide
        >
          <svg
            className="review-map"
            viewBox="0 0 1000 800"
            aria-label="Source layout with numbered detected path segments"
          >
            <image
              href={campus.images[floor]?.data}
              width="1000"
              height="800"
              preserveAspectRatio="xMidYMid meet"
            />
            {campus.edges.map((edge, index) => {
              const a = nodes.find((n) => n.id === edge.a),
                b = nodes.find((n) => n.id === edge.b);
              if (!a || !b || a.floor !== floor) return null;
              const points = edge.points ?? [a, b],
                mid = points[Math.floor(points.length / 2)];
              return (
                <g key={index}>
                  <polyline
                    points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="#b36324"
                    strokeWidth="5"
                  />
                  <text x={mid.x} y={mid.y} className="review-path-label">
                    {index + 1}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="review-place-list">
            {campus.places
              .filter((p) => p.floor === floor)
              .map((place) => (
                <label key={place.id}>
                  <Icon name={place.icon} size={17} />
                  <input
                    aria-label={`Name of detected place ${place.name}`}
                    value={place.name}
                    maxLength={90}
                    onChange={(event) =>
                      setSession((old) => ({
                        ...old,
                        campus: {
                          ...campus,
                          places: campus.places.map((p) =>
                            p.id === place.id
                              ? {
                                  ...p,
                                  name: event.target.value,
                                  ...categoryFor(event.target.value),
                                }
                              : p,
                          ),
                        },
                      }))
                    }
                  />
                </label>
              ))}
          </div>
          <details className="review-paths">
            <summary>Check or remove detected paths</summary>
            {campus.edges.map((edge, index) =>
              nodes.find((n) => n.id === edge.a)?.floor === floor ? (
                <div key={index}>
                  <span>Path {index + 1}</span>
                  <label>
                    <input
                      type="checkbox"
                      checked={edge.accessible}
                      onChange={(event) =>
                        setSession((old) => ({
                          ...old,
                          campus: {
                            ...campus,
                            edges: campus.edges.map((e, i) =>
                              i === index ? { ...e, accessible: event.target.checked } : e,
                            ),
                          },
                        }))
                      }
                    />
                    Step-free, checked by me
                  </label>
                  <button
                    className="text-button"
                    onClick={() =>
                      setSession((old) => ({
                        ...old,
                        campus: { ...campus, edges: campus.edges.filter((_, i) => i !== index) },
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
              ) : null,
            )}
          </details>
          <div className="import-warnings">
            {campus.images[floor]?.warnings?.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
          <label className="review-check">
            <input
              type="checkbox"
              checked={reviewChecked}
              onChange={(event) => setReviewChecked(event.target.checked)}
            />
            I checked the remaining paths and place entrances against the layout.
          </label>
          <button
            className="primary full"
            disabled={
              !reviewChecked ||
              !campus.places.filter((p) => p.floor === floor).length ||
              campus.places.some((p) => !p.name.trim())
            }
            onClick={confirmReview}
          >
            Use this map
            <Icon name="check" size={17} />
          </button>
          <button
            className="text-button full"
            onClick={() => {
              setModal(null);
              setEdit('pin');
              setMobileList(false);
            }}
          >
            Correct places or add a missing path
            <Icon name="edit" size={16} />
          </button>
        </Dialog>
      )}
      {modal === 'scan' && (
        <Dialog
          title="Scan. Arrive. Explore."
          subtitle="Open a UniWay campus map with a QR code."
          close={() => setModal(null)}
        >
          <Scanner onRead={readQr} />
          <div className="or-divider">or use a campus link</div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              readQr(link);
            }}
          >
            <label className="field-label" htmlFor="campus-link">
              UniWay campus link
            </label>
            <div className="link-input">
              <input
                id="campus-link"
                type="url"
                required
                placeholder="https://…?campus=demo"
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
              <button className="primary" type="submit" aria-label="Open campus link">
                <Icon name="arrow" size={18} />
              </button>
            </div>
          </form>
          <button
            className="text-button demo-entry"
            onClick={() => readQr(`${location.origin}/?campus=demo&entry=gate`)}
          >
            Try the demo entrance
            <Icon name="arrow" size={16} />
          </button>
          <p className="small muted">
            Opening a campus link starts a fresh three-hour session and replaces the current browser
            session.
          </p>
        </Dialog>
      )}
      {modal === 'share' && (
        <Dialog
          title="A shortcut to campus."
          subtitle="Scan this code to open Greenfield’s fictional demo at the main entrance."
          close={() => setModal(null)}
        >
          <div className="qr-sheet">
            <img src="/campus-qr.svg" alt="QR code for the UniWay Greenfield demo campus" />
            <strong>Greenfield University</strong>
            <span>MAIN ENTRANCE · DEMO CAMPUS</span>
          </div>
          <button
            className="primary full"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${location.origin}/?campus=demo&entry=gate`);
                notify('Campus link copied.');
              } catch {
                setLink(`${location.origin}/?campus=demo&entry=gate`);
                notify('Copy the campus link shown below.');
              }
            }}
          >
            <Icon name="link" size={18} />
            Copy campus link
          </button>
          <input
            className="share-url"
            aria-label="Campus share link"
            readOnly
            value={`${location.origin}/?campus=demo&entry=gate`}
            onFocus={(e) => e.target.select()}
          />
          <p className="small muted">
            This site is currently private. Visitors need access to open it. Your uploaded maps are
            never included in this QR code.
          </p>
        </Dialog>
      )}
      {modal === 'pin' && (
        <Dialog
          title="Give this place a name."
          subtitle="Add an entrance, room, landmark, or path junction."
          close={() => setModal(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addPin();
            }}
          >
            <label className="field-label" htmlFor="place-name">
              Place name
            </label>
            <input
              id="place-name"
              className="form-input"
              autoFocus
              required
              maxLength={80}
              placeholder="e.g. Library entrance"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <label className="field-label" htmlFor="place-category">
              Category
            </label>
            <select
              id="place-category"
              className="form-input"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            >
              {['Study', 'Food', 'Services', 'Outdoors'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button className="primary full" type="submit" disabled={!newName.trim()}>
              Add place
              <Icon name="plus" size={18} />
            </button>
          </form>
        </Dialog>
      )}
      {modal === 'help' && (
        <Dialog title="A little help along the way." close={() => setModal(null)}>
          <div className="help-list">
            <section>
              <Icon name="map" />
              <div>
                <h3>Make the campus yours</h3>
                <p>
                  Search or select a map marker. Choose Directions, set your starting point, and
                  follow the written steps. Drag to move the map; use + and − to zoom. Rotate with
                  the arrow buttons or two fingers, then tap the compass to reset orientation.
                </p>
              </div>
            </section>
            <section>
              <Icon name="upload" />
              <div>
                <h3>Bring your own map</h3>
                <p>
                  Upload a clear layout photo. UniWay reads labels and detects building and path
                  shapes, then shows a generated map. Compare it with the source and correct
                  mistakes in Edit. Each image is a separate level; cross-level routes are not
                  supported yet.
                </p>
              </div>
            </section>
            <section>
              <Icon name="shield" />
              <div>
                <h3>Temporary by design</h3>
                <p>
                  Maps stay in this browser for three hours. Expiry is checked when you return.
                  Screenshots cannot be revoked. Your theme preference is saved separately.
                </p>
              </div>
            </section>
            <section>
              <Icon name="leaf" />
              <div>
                <h3>Light on your device</h3>
                <p>
                  Routes are calculated locally. Text recognition runs only during import, in a
                  worker that closes afterward. No location tracking or background camera. The demo
                  is fictional; confirm real paths and access conditions on site.
                </p>
              </div>
            </section>
          </div>
        </Dialog>
      )}
      {expired && (
        <Dialog
          title="A fresh start awaits."
          subtitle="Your temporary session has ended. Your map images and saved places have been cleared from this browser."
          dismissible={false}
          close={() => {}}
        >
          <div className="expired-art">
            <Icon name="leaf" size={52} />
          </div>
          <button className="primary full" onClick={resetSession}>
            Start a new session
            <Icon name="arrow" />
          </button>
          <p className="small muted">Your theme preference is remembered.</p>
        </Dialog>
      )}
      {toast &&
        createPortal(
          <div className="toast" role="status">
            <Icon name="check" size={18} />
            {toast}
            <button onClick={() => setToast('')} aria-label="Dismiss notification">
              <Icon name="close" size={15} />
            </button>
          </div>,
          document.querySelector('dialog[open]') || document.body,
        )}
      {!ready && (
        <div className="loading-screen">
          <span className="loading-brand">uniway.</span>
          <p>Getting your bearings…</p>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
