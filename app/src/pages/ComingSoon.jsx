import { MessageCircle, Sparkles, CalendarDays } from 'lucide-react'
import { useBusiness } from '../components/Layout'
import { Empty } from '../components/ui'

const INFO = {
  messaged: { icon: MessageCircle, title: 'Messaged Leads', phase: 3, text: 'Once WhatsApp Business Cloud API is connected, this page will automatically organise everyone you message, with delivery status, replies and full conversation history.' },
  studio: { icon: Sparkles, title: 'AI Message Studio', phase: 2, text: 'Generate WhatsApp messages by purpose, greeting, opening, tone and length, using only the verified details you enter in Business Settings.' },
  planner: { icon: CalendarDays, title: '7-Day Growth Planner', phase: 4, text: 'Generate a personalised 7-day action plan from your real leads, replies and calls, then tick off tasks day by day.' },
}

export default function ComingSoon({ feature }) {
  const { business } = useBusiness()
  const i = INFO[feature]
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">{i.title}</h1>
      <Empty icon={i.icon} title={`Coming in Phase ${i.phase}`}>{i.text} It will work separately for {business.name}.</Empty>
    </div>
  )
}
