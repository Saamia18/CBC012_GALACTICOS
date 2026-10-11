import React, { useMemo, useRef, useState } from 'react';
import { Bot, MessageCircle, Send, X } from 'lucide-react';
import { BookingRecord, ResourceUnit } from '../types/scheduling';

interface MiniChatbotProps {
  resources: ResourceUnit[];
  bookings: BookingRecord[];
  onAsk?: (question: string, context: ChatbotContext) => Promise<string>;
}

interface ChatbotContext {
  resources: ResourceUnit[];
  bookings: BookingRecord[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const SUGGESTIONS = [
  'What equipment is available?',
  'How do I book equipment?',
  'What happens if there is a booking conflict?',
  'How does QR check-in work?',
];

const activeStatuses = ['confirmed', 'pending', 'in-use', 'checked-in', 'maintenance'];

const answerFromLocalData = (question: string, { resources, bookings }: ChatbotContext) => {
  const normalized = question.toLowerCase();
  const available = resources.filter((item) => item.status === 'available');
  const maintenance = resources.filter((item) => item.status === 'maintenance');
  const activeBookings = bookings.filter((booking) => activeStatuses.includes(booking.status));

  if (normalized.includes('available') || normalized.includes('availability') || normalized.includes('equipment')) {
    const examples = available.slice(0, 4).map((item) => `${item.name} ${item.unitId}`).join(', ');
    return available.length
      ? `${available.length} units are currently available. Good options: ${examples}. Use Equipment or Calendar filters to narrow by category.`
      : `No units are marked available right now. ${maintenance.length} unit${maintenance.length === 1 ? ' is' : 's are'} under maintenance.`;
  }

  if (normalized.includes('book')) {
    return 'Open the Booking Calendar, choose a Day/Week/Month view, click an open slot beside the equipment, then submit the booking details. The calendar checks overlaps before saving.';
  }

  if (normalized.includes('conflict') || normalized.includes('overlap')) {
    return `ZeroClash blocks overlapping active bookings for the same equipment. The current schedule has ${activeBookings.length} active booking records across ${resources.length} units.`;
  }

  if (normalized.includes('qr') || normalized.includes('check-in') || normalized.includes('check out') || normalized.includes('checkout')) {
    return 'Use My Bookings to open a booking QR code. Scan it with the camera or paste the booking ID. Check-in opens near the booking time, and check-out is allowed only after check-in.';
  }

  return 'I can help with equipment availability, booking steps, booking conflicts, and QR check-in/check-out.';
};

export const MiniChatbot: React.FC<MiniChatbotProps> = ({ resources, bookings, onAsk }) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Ask about availability, booking, conflicts, or QR check-in.',
    },
  ]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const context = useMemo(() => ({ resources, bookings }), [bookings, resources]);

  const ask = async (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (!question || typing) return;
    setInput('');
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', text: question }]);
    setTyping(true);

    window.setTimeout(async () => {
      try {
        const response = onAsk ? await onAsk(question, context) : answerFromLocalData(question, context);
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: response }]);
      } catch {
        setMessages((current) => [
          ...current,
          { id: crypto.randomUUID(), role: 'assistant', text: 'I could not answer that yet. Try one of the suggested questions.' },
        ]);
      } finally {
        setTyping(false);
      }
    }, 520);
  };

  return (
    <div className="fixed bottom-5 right-5 z-[100]">
      {open && (
        <div className="mb-3 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-glass backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-400">
                <Bot className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">ZeroClash Assistant</div>
                <div className="text-[11px] text-[var(--muted)]">Campus booking help</div>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]" title="Close assistant">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto px-4 py-3">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-5 ${
                    message.role === 'user'
                      ? 'bg-cyan-400 text-slate-950'
                      : 'border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text)]'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
            {typing && (
              <div className="inline-flex items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400 [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400 [animation-delay:240ms]" />
              </div>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto border-t border-[var(--border)] px-4 py-3">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => void ask(suggestion)}
                className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-1.5 text-[11px] text-[var(--text)] transition hover:border-cyan-400/50 hover:text-cyan-500"
              >
                {suggestion}
              </button>
            ))}
          </div>

          <form
            className="flex items-center gap-2 border-t border-[var(--border)] p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(input);
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask a booking question"
              className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-cyan-400/60"
            />
            <button type="submit" className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 text-slate-950 hover:bg-cyan-300" title="Send">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          window.setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400 text-slate-950 shadow-[0_14px_40px_rgba(34,211,238,0.28)] transition hover:-translate-y-0.5 hover:bg-cyan-300"
        title="Open ZeroClash assistant"
        aria-label="Open ZeroClash assistant"
      >
        <MessageCircle className="h-5 w-5" />
      </button>
    </div>
  );
};
