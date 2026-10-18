import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Compass } from 'lucide-react'

const steps = [
  { title: 'The idea', description: 'Start with the people and the problem.', fields: [
    ['offer', 'Product or service', 'What will you sell or provide?'],
    ['target_customers', 'Customers', 'Who will buy it, and when will they need it?'],
    ['problem', 'Customer problem', 'What need will your offer address?'],
    ['existing_business', 'Current stage', 'Is this a new proposal or already operating?'],
  ] },
  { title: 'The market', description: 'Share what you know from the real world.', fields: [
    ['location', 'Business location', 'Which locality, district and state will you serve?'],
    ['market_research', 'Demand evidence', 'Have you spoken to customers or tested demand? What happened?'],
    ['competition', 'Competition', 'Which alternatives do your customers already use?'],
    ['differentiation', 'Your difference', 'What will make customers choose your offer?'],
  ] },
  { title: 'The numbers', description: 'Estimates are welcome. Label them clearly.', fields: [
    ['investment', 'Startup investment', 'How much do you need to start? Include currency and what it covers.'],
    ['unit_price', 'Selling price', 'What will you charge per item or service? Include currency and unit.'],
    ['revenue', 'Expected revenue', 'What sales do you expect? Include currency and time period.'],
    ['expenses', 'Expected expenses', 'What running costs do you expect for the same time period?'],
  ] },
] as const

export type GuidedAnswers = Record<string, string>
export function guidedSource(answers: GuidedAnswers): string {
  const supplied = steps.flatMap(step => step.fields.filter(([key]) => answers[key]?.trim()).map(([key, label]) => `${label}: ${answers[key].trim()}`))
  return supplied.length ? 'Applicant business idea (self-reported; estimates are not verified):\n' + supplied.join('\n\n') : ''
}

export function GuidedIdea({ answers, onChange }: { answers: GuidedAnswers; onChange: (answers: GuidedAnswers) => void }) {
  const [step, setStep] = useState(0)
  const current = steps[step]
  const count = steps.reduce((total, item) => total + item.fields.filter(([key]) => answers[key]?.trim()).length, 0)
  return <div className="guided-idea">
    <div className="builder-intro"><Compass size={24} /><div><strong>A little help to shape your idea</strong><p>Answer in your own words. Skip anything you don’t know; we’ll ask about useful gaps after assessment.</p></div><span className="badge">{count} / 12 answered</span></div>
    <nav className="builder-steps" aria-label="Guided idea steps">{steps.map((item, index) => <button key={item.title} type="button" aria-pressed={step === index} onClick={() => setStep(index)}><span>{item.fields.every(([key]) => answers[key]?.trim()) ? <Check size={14} /> : `0${index + 1}`}</span>{item.title}</button>)}</nav>
    <div className="builder-stage"><h3>{current.title}</h3><p className="field-note">{current.description}</p><div className="guided-fields">{current.fields.map(([key, label, question]) => <label key={key}>{label}<span className="optional"> · optional</span><textarea aria-label={`Guided ${label.toLowerCase()}`} rows={2} maxLength={1500} value={answers[key] || ''} onChange={event => onChange({ ...answers, [key]: event.target.value })} placeholder={question} /></label>)}</div></div>
    <div className="builder-controls"><button type="button" className="secondary-button" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft size={15} />Back</button><span>{step + 1} of {steps.length}</span>{step < steps.length - 1 ? <button type="button" className="secondary-button" onClick={() => setStep(step + 1)}>Next questions<ArrowRight size={15} /></button> : <span className="field-note">Review your source below, then submit.</span>}</div>
    <details><summary>Preview the text you will submit</summary><p className="original-text">{guidedSource(answers) || 'Your answers will appear here. Nothing is filled in for you.'}</p><p className="field-note">Unanswered fields remain missing. There is no invented price, demand estimate or sector standard.</p></details>
  </div>
}
