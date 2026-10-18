import type { Assessment } from '../api/client'
import type { components } from '../api/generated/schema'

export type Economics = components['schemas']['Economics']
export type Finding = { code: 'loss' | 'funding_gap' | 'number_conflict' | 'source_review' | 'weak_dimension' | 'missing_information'; fields: string[]; amount?: string; period?: string | null }

/** Review routing, never a business-success classifier or an automatic funding decision. */
export function screeningFindings(value: Assessment, numbers: Economics | null): Finding[] {
  const findings: Finding[] = []
  const currentNumbers = numbers?.assessment_id === value.id ? numbers : null
  if (currentNumbers) {
    for (const check of currentNumbers.checks) {
      const calculated = check.calculated_amount === null ? NaN : Number(check.calculated_amount)
      const stated = check.stated_amount === null ? NaN : Number(check.stated_amount)
      if (check.kind === 'profit' && Number.isFinite(calculated) && calculated < 0) {
        findings.push({ code: 'loss', fields: ['revenue', 'expenses'], amount: check.calculated_amount!, period: check.period })
      }
      if (check.kind === 'funding' && Number.isFinite(calculated) && Number.isFinite(stated) && calculated < stated - 1) {
        findings.push({ code: 'funding_gap', fields: ['investment', 'own_funds', 'requested_loan'], amount: (stated - calculated).toFixed(2) })
      } else if (check.status === 'discrepancy') {
        findings.push({ code: 'number_conflict', fields: check.kind === 'funding' ? ['investment', 'own_funds', 'requested_loan'] : check.kind === 'profit' ? ['revenue', 'expenses', 'profit'] : ['unit_price', 'revenue'] })
      }
    }
  }
  if (value.evidence.some(source => source.translation_uncertain || source.language?.needs_confirmation ||
    (source.kind === 'pdf' && source.extraction_uncertain) || (source.kind === 'audio' && source.transcription_uncertain))) {
    findings.push({ code: 'source_review', fields: [] })
  }
  const weak = value.domains.filter(domain => domain.rating !== null && domain.rating <= 1)
  if (weak.length) findings.push({ code: 'weak_dimension', fields: [] })
  if (!currentNumbers || value.scores.needs_clarification || currentNumbers.checks.some(check => check.status === 'needs_clarification')) {
    findings.push({ code: 'missing_information', fields: ['offer', 'target_customers', 'revenue', 'expenses'].filter(name => {
      const field = value.business[name as keyof typeof value.business]
      return field && typeof field === 'object' && 'status' in field && field.status !== 'present'
    }) })
  }
  return findings
}
