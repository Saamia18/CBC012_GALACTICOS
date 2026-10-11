import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, Clipboard, IdCard, LogIn, LogOut, QrCode, ScanLine, XCircle } from 'lucide-react';
import { BookingRecord } from '../types/scheduling';
import { parseQrToken } from '../lib/schedulingData';
import { createQrMatrix } from '../utils/qrCode';

interface MyBookingsQRCodeProps {
  bookings: BookingRecord[];
  onCheckIn: (payload: string, actor?: string) => Promise<void>;
  onCheckOut: (payload: string, actor?: string) => Promise<void>;
}

const isCheckable = (booking: BookingRecord) => ['confirmed', 'in-use', 'checked-in', 'checked-out'].includes(booking.status);

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const checkInWindowMessage = (booking: BookingRecord) => {
  const now = Date.now();
  const starts = new Date(booking.startAt).getTime();
  const ends = new Date(booking.endAt).getTime();
  if (now < starts - 15 * 60_000) return 'Check-in opens 15 minutes before the booking start time.';
  if (now > ends) return 'Check-in is closed because the booking has ended.';
  return null;
};

type ScanResolution = { booking: BookingRecord; payload: string } | { error: string };

export const MyBookingsQRCode: React.FC<MyBookingsQRCodeProps> = ({ bookings, onCheckIn, onCheckOut }) => {
  const allMyBookings = useMemo(
    () =>
      bookings
        .filter(isCheckable)
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [bookings],
  );
  const [showAllBookings, setShowAllBookings] = useState(false);
  const myBookings = showAllBookings ? allMyBookings : allMyBookings.slice(0, 6);
  const hiddenBookingCount = Math.max(0, allMyBookings.length - myBookings.length);
  const [selectedId, setSelectedId] = useState('');
  const selected = allMyBookings.find((booking) => booking.id === selectedId) ?? null;
  const [scanMode, setScanMode] = useState<'check-in' | 'check-out'>('check-in');
  const [manualPayload, setManualPayload] = useState('');
  const [scanStatus, setScanStatus] = useState<string>('Camera scanner is optional; manual demo scan is always available.');
  const [scanTone, setScanTone] = useState<'info' | 'success' | 'error'>('info');
  const [scannedBookingId, setScannedBookingId] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanSessionRef = useRef(0);
  const scannedBooking = scannedBookingId ? bookings.find((booking) => booking.id === scannedBookingId) : null;

  useEffect(() => {
    if (selectedId && !allMyBookings.some((booking) => booking.id === selectedId)) {
      setSelectedId('');
      setManualPayload('');
    }
  }, [allMyBookings, selectedId]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const resolveScanInput = (input: string): ScanResolution => {
    const trimmed = input.trim();
    if (!trimmed) return { error: 'Enter a QR payload or booking ID.' };

    const directBooking = bookings.find((booking) => booking.id === trimmed);
    if (directBooking) return { booking: directBooking, payload: directBooking.qrToken };

    const parsed = parseQrToken(trimmed);
    if (!parsed) return { error: 'Invalid ZeroClash QR payload or booking ID.' };

    const booking = bookings.find((item) => item.id === parsed.bookingId);
    if (!booking || booking.equipmentId !== parsed.equipmentId || booking.startAt !== parsed.startAt || booking.qrToken !== trimmed) {
      return { error: 'This QR code does not match an active ZeroClash booking.' };
    }
    return { booking, payload: trimmed };
  };

  const validateAction = (booking: BookingRecord) => {
    if (scanMode === 'check-in') {
      if (!['confirmed', 'in-use'].includes(booking.status)) return `Check-in blocked. Booking status is ${booking.status}.`;
      if (booking.checkedInAt) return `${booking.equipmentName} ${booking.unitId} was already checked in.`;
      return checkInWindowMessage(booking);
    }

    if (!booking.checkedInAt) return 'Check-out blocked. This booking has not been checked in yet.';
    if (booking.checkedOutAt || booking.status === 'checked-out') return `${booking.equipmentName} ${booking.unitId} was already checked out.`;
    if (booking.status !== 'checked-in') return 'Unauthorized check-out. Only a checked-in booking can be checked out in this demo.';
    return null;
  };

  const runPayload = async (payload: string) => {
    const resolved = resolveScanInput(payload);
    if ('error' in resolved) {
      setScannedBookingId(null);
      setScanTone('error');
      setScanStatus(resolved.error);
      return;
    }

    const validationError = validateAction(resolved.booking);
    setScannedBookingId(resolved.booking.id);
    if (validationError) {
      setScanTone('error');
      setScanStatus(validationError);
      return;
    }

    try {
      if (scanMode === 'check-in') {
        await onCheckIn(resolved.payload, 'QR Demo User');
      } else {
        await onCheckOut(resolved.payload, 'QR Demo User');
      }
      setScanTone('success');
      setScanStatus(`${scanMode === 'check-in' ? 'Check-in' : 'Check-out'} accepted for ${resolved.booking.equipmentName} ${resolved.booking.unitId}.`);
    } catch (err) {
      setScanTone('error');
      setScanStatus(err instanceof Error ? err.message : 'QR scan failed.');
    }
  };

  const startCamera = async () => {
    const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
    if (!BarcodeDetectorCtor || !navigator.mediaDevices?.getUserMedia) {
      setScanTone('error');
      setScanStatus('Camera QR decoding is not available in this browser. Use the manual demo scan below.');
      return;
    }

    try {
      const session = scanSessionRef.current + 1;
      scanSessionRef.current = session;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
      setCameraActive(true);
      setScanTone('info');
      setScanStatus('Camera active. Point it at a ZeroClash QR code.');

      const scan = async () => {
        if (!videoRef.current || scanSessionRef.current !== session) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const code = codes[0]?.rawValue;
          if (code) {
            stopCamera();
            setManualPayload(code);
            await runPayload(code);
            return;
          }
        } catch {
          setScanStatus('Camera is active, but no QR code has been detected yet.');
        }
        window.setTimeout(scan, 700);
      };
      void scan();
    } catch {
      setScanTone('error');
      setScanStatus('Camera permission was blocked or unavailable. Use the manual demo scan below.');
      stopCamera();
    }
  };

  const stopCamera = () => {
    scanSessionRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  return (
    <section id="my-bookings" className="scroll-mt-6 rounded-lg border border-cyan-500/20 bg-slate-950/70 p-4 md:p-5 shadow-glass">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-cyan-300">
            <IdCard className="h-4 w-4 text-cyan-300 dark:text-cyan-300" />
            My Bookings
          </div>
          <h2 className="mt-2 text-xl font-semibold text-white">QR check-in and check-out</h2>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setScanMode('check-in')} className={`rounded-md px-3 py-2 text-xs font-semibold ${scanMode === 'check-in' ? 'bg-emerald-400 text-slate-950' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>
            <LogIn className="mr-1 inline h-4 w-4" />
            Check-In
          </button>
          <button type="button" onClick={() => setScanMode('check-out')} className={`rounded-md px-3 py-2 text-xs font-semibold ${scanMode === 'check-out' ? 'bg-cyan-400 text-slate-950' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>
            <LogOut className="mr-1 inline h-4 w-4" />
            Check-Out
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_420px]">
        <div>
          <div className="grid gap-2 md:grid-cols-2">
          {myBookings.map((booking) => (
            <button
              key={booking.id}
              type="button"
              onClick={() => {
                setSelectedId(booking.id);
                setManualPayload(booking.qrToken);
              }}
              className={`rounded-xl border p-3 text-left transition hover:border-cyan-400/50 ${selected?.id === booking.id ? 'border-cyan-400/60 bg-cyan-950/20' : 'border-slate-800 bg-slate-950'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <IdCard className="h-4 w-4 text-cyan-300 dark:text-cyan-300" />
                    <span className="truncate">{booking.equipmentName}</span> <span className="font-mono text-cyan-300">{booking.unitId}</span>
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-400">{booking.buildingName}</div>
                </div>
                <StatusPill booking={booking} />
              </div>
              <div className="mt-2 text-xs leading-5 text-slate-300">{formatDateTime(booking.startAt)} - {formatDateTime(booking.endAt)}</div>
            </button>
          ))}
          {myBookings.length === 0 && <div className="rounded-lg border border-slate-800 bg-slate-950 p-5 text-sm text-slate-500">No active demo bookings are available.</div>}
          </div>
          {allMyBookings.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAllBookings((value) => !value)}
              className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:border-cyan-400/40 hover:bg-cyan-950/20"
            >
              {showAllBookings ? 'Show fewer bookings' : `View all bookings (${hiddenBookingCount} more)`}
            </button>
          )}
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <QrCode className="h-4 w-4 text-cyan-300" />
                    {selected.equipmentName} {selected.unitId}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{formatDateTime(selected.startAt)} - {formatDateTime(selected.endAt)}</div>
                </div>
                <StatusPill booking={selected} />
              </div>
              <div className="mt-4 flex justify-center rounded-lg border border-slate-800 bg-white p-4">
                <DemoQrSvg payload={selected.qrToken} />
              </div>
              <div className="mt-3 grid gap-2 rounded-md border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-300">
                <Detail label="Booking ID" value={selected.id} />
                <Detail label="Equipment" value={`${selected.equipmentName} ${selected.unitId}`} />
                <Detail label="Booked slot" value={`${formatDateTime(selected.startAt)} - ${formatDateTime(selected.endAt)}`} />
                <Detail label="User" value={`${selected.requesterName} · ${selected.requesterRole}`} />
                <Detail label="Status" value={selected.status} />
                <Detail label="Check-in" value={selected.checkedInAt ? formatDateTime(selected.checkedInAt) : 'Not yet'} />
                <Detail label="Check-out" value={selected.checkedOutAt ? formatDateTime(selected.checkedOutAt) : 'Not yet'} />
              </div>
              <div className="mt-3 rounded-md border border-slate-800 bg-slate-900/70 p-3 font-mono text-[11px] leading-5 text-slate-300 break-all">
                {selected.qrToken}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={startCamera} className="rounded-md bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300">
                  <Camera className="mr-1 inline h-4 w-4" />
                  Scan Camera
                </button>
                <button type="button" onClick={stopCamera} disabled={!cameraActive} className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-900 disabled:opacity-50">
                  Stop
                </button>
              </div>
              <video ref={videoRef} className={`mt-3 aspect-video w-full rounded-lg border border-slate-800 bg-black object-cover ${cameraActive ? 'block' : 'hidden'}`} muted playsInline />
              <div className="mt-4 rounded-md border border-slate-800 bg-slate-900/60 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <ScanLine className="h-4 w-4 text-cyan-300" />
                  Manual demo scan
                </div>
                <textarea value={manualPayload} onChange={(event) => setManualPayload(event.target.value)} rows={3} className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200" placeholder="Paste QR payload or booking ID" />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => void runPayload(manualPayload)} className="rounded-md bg-emerald-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-300">
                    Run {scanMode}
                  </button>
                  <button type="button" onClick={() => void navigator.clipboard?.writeText(selected.qrToken)} className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-900">
                    <Clipboard className="mr-1 inline h-4 w-4" />
                    Copy
                  </button>
                </div>
              </div>
              {scannedBooking && (
                <div className="mt-3 rounded-md border border-slate-800 bg-slate-900/60 p-3 text-xs leading-5 text-slate-300">
                  <div className="mb-1 font-semibold text-white">Scanned booking</div>
                  <div>{scannedBooking.id}</div>
                  <div>{scannedBooking.equipmentName} {scannedBooking.unitId} · {scannedBooking.status}</div>
                  <div>{formatDateTime(scannedBooking.startAt)} - {formatDateTime(scannedBooking.endAt)}</div>
                  <div>{scannedBooking.requesterName} · {scannedBooking.requesterRole}</div>
                </div>
              )}
              <div className={`mt-3 rounded-md border p-3 text-xs leading-5 ${
                scanTone === 'success'
                  ? 'border-emerald-400/25 bg-emerald-950/20 text-emerald-100'
                  : scanTone === 'error'
                  ? 'border-rose-400/25 bg-rose-950/20 text-rose-100'
                  : 'border-cyan-400/20 bg-cyan-950/20 text-cyan-100'
              }`}>{scanStatus}</div>
            </>
          ) : (
            <div className="text-sm text-slate-500">Select a booking to view its QR code.</div>
          )}
        </div>
      </div>
    </section>
  );
};

const StatusPill: React.FC<{ booking: BookingRecord }> = ({ booking }) => {
  const tone =
    booking.status === 'checked-in'
      ? 'border-cyan-300/40 bg-cyan-300/15 text-cyan-100'
      : booking.status === 'checked-out'
      ? 'border-slate-500/40 bg-slate-500/15 text-slate-200'
      : booking.status === 'confirmed' || booking.status === 'in-use'
      ? 'border-emerald-300/40 bg-emerald-300/15 text-emerald-100'
      : 'border-amber-300/40 bg-amber-300/15 text-amber-100';
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold capitalize ${tone}`}>
      {booking.status === 'checked-out' ? <CheckCircle2 className="h-3.5 w-3.5" /> : booking.status === 'cancelled' ? <XCircle className="h-3.5 w-3.5" /> : null}
      {booking.status}
    </span>
  );
};

const DemoQrSvg: React.FC<{ payload: string }> = ({ payload }) => {
  const cells = useMemo(() => createQrMatrix(payload), [payload]);
  const size = cells.length;

  return (
    <svg viewBox={`0 0 ${size + 8} ${size + 8}`} className="h-56 w-56" role="img" aria-label="Booking QR code">
      <rect width={size + 8} height={size + 8} fill="#ffffff" />
      {cells.flatMap((row, y) =>
        row.map((filled, x) => (filled ? <rect key={`${x}-${y}`} x={x + 4} y={y + 4} width="1" height="1" fill="#020617" /> : null)),
      )}
    </svg>
  );
};

const Detail: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="grid grid-cols-[92px_1fr] gap-2">
    <span className="text-slate-500">{label}</span>
    <span className="break-words text-slate-200">{value}</span>
  </div>
);
