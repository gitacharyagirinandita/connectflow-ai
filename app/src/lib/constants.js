export const BUSINESS_THEME = {
  'health-coaching': { emoji: '🌿', accent: 'emerald', bg: 'bg-emerald-600', soft: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  'ratnagiri-gurukula': { emoji: '🪷', accent: 'amber', bg: 'bg-amber-600', soft: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
}

export const MESSAGE_STATUS = {
  not_sent: { label: 'Not yet sent', dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-700' },
  sent: { label: 'Message sent', dot: 'bg-green-500', chip: 'bg-green-100 text-green-800' },
  replied: { label: 'Reply received', dot: 'bg-blue-500', chip: 'bg-blue-100 text-blue-800' },
  follow_up: { label: 'Follow-up pending', dot: 'bg-orange-500', chip: 'bg-orange-100 text-orange-800' },
}

export const LEAD_STATUS = {
  new: 'New',
  contacted: 'Contacted',
  interested: 'Interested',
  requested_info: 'Requested info',
  call_booked: '1:1 call booked',
  follow_up: 'Follow-up',
  not_interested: 'Not interested',
  converted: 'Converted',
}

export const PERMISSION = {
  unknown: { label: 'Unknown', chip: 'bg-slate-100 text-slate-600' },
  pending: { label: 'Pending', chip: 'bg-yellow-100 text-yellow-800' },
  opted_in: { label: 'Opted in', chip: 'bg-green-100 text-green-800' },
  opted_out: { label: 'Opted out', chip: 'bg-red-100 text-red-700' },
}

export const CALL_OUTCOME = {
  interested: 'Interested',
  requested_info: 'Requested information',
  one_to_one_agreed: 'One-to-one call agreed',
  follow_up_required: 'Follow-up required',
  not_interested: 'Not interested',
  no_answer: 'No answer',
}

export const INTEREST = { high: 'High', medium: 'Medium', low: 'Low', none: 'None' }

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—'
export const leadName = (l) => l?.name || l?.phone || 'Unnamed lead'

// Normalise Indian phone numbers to +91XXXXXXXXXX where possible
export function normalisePhone(raw) {
  if (!raw) return ''
  let p = raw.replace(/[^\d+]/g, '')
  if (/^\d{10}$/.test(p)) p = '+91' + p
  else if (/^91\d{10}$/.test(p)) p = '+' + p
  else if (/^0\d{10}$/.test(p)) p = '+91' + p.slice(1)
  return p
}

// Today's date in the user's local time zone (YYYY-MM-DD)
export const todayISO = () => new Date().toLocaleDateString('en-CA')
