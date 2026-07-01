import { useState, useEffect, useRef } from 'react';
import { Icon } from '../icons';
export function Scanner({ onRead }: { onRead: (value: string) => void }) {
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    frame = useRef<number>(0),
    generation = useRef(0),
    opening = useRef(false);
  const [status, setStatus] = useState('Point your camera at a UniWay campus QR code.');
  const [active, setActive] = useState(false);
  const stop = () => {
    generation.current++;
    opening.current = false;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    window.clearTimeout(frame.current);
    setActive(false);
  };
  useEffect(() => {
    const hide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', hide);
    };
  }, []);
  const start = async () => {
    if (opening.current) return;
    opening.current = true;
    const request = ++generation.current;
    try {
      if (!('BarcodeDetector' in window)) {
        setStatus(
          'Camera QR reading is not supported in this browser. Use your phone camera to open the QR link, or paste the campus link below.',
        );
        return;
      }
      const Detector = (window as any).BarcodeDetector;
      if (
        Detector.getSupportedFormats &&
        !(await Detector.getSupportedFormats()).includes('qr_code')
      ) {
        setStatus(
          'This browser cannot decode QR codes. Use your phone camera or paste the campus link below.',
        );
        return;
      }
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      if (request !== generation.current || document.hidden || !video.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = s;
      video.current.srcObject = s;
      await video.current.play();
      if (request !== generation.current || document.hidden) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      setActive(true);
      setStatus('Looking for a UniWay QR code…');
      const detector = new Detector({ formats: ['qr_code'] });
      const scan = async () => {
        if (!stream.current || !video.current) return;
        try {
          const codes = await detector.detect(video.current);
          if (request !== generation.current) return;
          if (codes.length) {
            stop();
            onRead(codes[0].rawValue);
            return;
          }
        } catch {}
        if (request !== generation.current) return;
        frame.current = window.setTimeout(scan, 400);
      };
      scan();
    } catch {
      if (request === generation.current) {
        stop();
        setStatus('Camera unavailable. Check camera permission, or paste your campus link below.');
      }
    } finally {
      if (request === generation.current) opening.current = false;
    }
  };
  return (
    <>
      <div className={`scanner ${active ? 'active' : ''}`}>
        <video ref={video} muted playsInline />
        <div className="scan-corners" />
        {!active && <Icon name="qr" size={62} />}
      </div>
      <p className="small muted" role="status">
        {status}
      </p>
      <button className="secondary full" onClick={active ? stop : start}>
        <Icon name="qr" />
        {active ? 'Stop camera' : 'Open camera'}
      </button>
    </>
  );
}
